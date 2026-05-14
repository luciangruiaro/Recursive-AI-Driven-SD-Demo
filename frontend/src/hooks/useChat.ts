import { useCallback, useState } from "react";

import { api } from "@/api/client";

export type ChatStatus = "idle" | "loading" | "success" | "error";

interface ChatState {
  status: ChatStatus;
  response: string | null;
  model: string | null;
  error: string | null;
}

const initial: ChatState = {
  status: "idle",
  response: null,
  model: null,
  error: null,
};

export interface ChatController extends ChatState {
  send: (message: string) => Promise<void>;
  reset: () => void;
}

export function useChat(): ChatController {
  const [state, setState] = useState<ChatState>(initial);

  const send = useCallback(async (message: string) => {
    setState({ status: "loading", response: null, model: null, error: null });
    try {
      const { content, model } = await api.sendMessage(message);
      setState({ status: "success", response: content, model, error: null });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : "Unknown error";
      setState({ status: "error", response: null, model: null, error });
    }
  }, []);

  const reset = useCallback(() => setState(initial), []);

  return { ...state, send, reset };
}
