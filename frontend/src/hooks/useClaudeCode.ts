import { useCallback, useRef, useState } from "react";

import { api } from "@/api/client";
import type { ClaudeCodeEvent } from "@/types";

export type ClaudeCodeStatus = "idle" | "running" | "done" | "error";

interface ClaudeCodeState {
  status: ClaudeCodeStatus;
  events: ClaudeCodeEvent[];
  error: string | null;
  prompt: string | null;
}

const initial: ClaudeCodeState = {
  status: "idle",
  events: [],
  error: null,
  prompt: null,
};

export interface ClaudeCodeController extends ClaudeCodeState {
  send: (prompt: string) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

export function useClaudeCode(): ClaudeCodeController {
  const [state, setState] = useState<ClaudeCodeState>(initial);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (prompt: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ status: "running", events: [], error: null, prompt });

    try {
      await api.executeClaudeCode(
        prompt,
        {},
        {
          onEvent: (event) => {
            setState((s) => ({ ...s, events: [...s.events, event] }));
          },
        },
        controller.signal,
      );
      setState((s) => ({ ...s, status: "done" }));
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
