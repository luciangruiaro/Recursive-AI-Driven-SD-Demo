import { useCallback, useRef, useState } from "react";

import { api } from "@/api/client";
import type { SelfEvolveEvent } from "@/types";

export type SelfEvolveStatus = "idle" | "running" | "done" | "error";

interface SelfEvolveState {
  status: SelfEvolveStatus;
  events: SelfEvolveEvent[];
  error: string | null;
  prompt: string | null;
}

const initial: SelfEvolveState = {
  status: "idle",
  events: [],
  error: null,
  prompt: null,
};

export interface SelfEvolveController extends SelfEvolveState {
  send: (prompt: string) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

export function useSelfEvolve(): SelfEvolveController {
  const [state, setState] = useState<SelfEvolveState>(initial);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (prompt: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ status: "running", events: [], error: null, prompt });

    try {
      await api.executeSelfEvolve(
        prompt,
        {
          onEvent: (event) => {
            setState((s) => ({ ...s, events: [...s.events, event] }));
          },
        },
        controller.signal,
      );
      // If the server emitted an in-stream error event, surface it as the
      // hook's terminal error too — UX is clearer with one place to look.
      setState((s) => {
        const lastError = [...s.events]
          .reverse()
          .find((e) => e.type === "error") as { error: string } | undefined;
        if (lastError) {
          return { ...s, status: "error", error: lastError.error };
        }
        return { ...s, status: "done" };
      });
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const error = e instanceof Error ? e.message : "Unknown error";
      setState((s) => ({ ...s, status: "error", error }));
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => (s.status === "running" ? { ...s, status: "idle" } : s));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(initial);
  }, []);

  return { ...state, send, cancel, reset };
}
