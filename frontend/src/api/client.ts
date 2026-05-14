/** Thin HTTP client. In dev all requests are relative — the Vite proxy
 *  forwards `/api/*` to the backend. In prod, set `VITE_API_BASE_URL`. */

import type {
  ChatResponse,
  ClaudeCodeEvent,
  ClaudeCodeOptions,
  UiConfig,
} from "@/types";

const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
    } catch {
      /* response wasn't JSON; keep statusText */
    }
    throw new Error(`Request failed (${response.status}): ${detail}`);
  }

  return response.json() as Promise<T>;
}

interface ClaudeCodeStreamHandlers {
  onEvent: (event: ClaudeCodeEvent) => void;
}

/** POST /api/claude-code/execute and stream ndjson events to ``onEvent``.
 *  Resolves when the stream is fully consumed; throws on non-2xx response.
 *  Pass an ``AbortSignal`` to cancel mid-stream. */
async function executeClaudeCode(
  prompt: string,
  options: ClaudeCodeOptions,
  handlers: ClaudeCodeStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/claude-code/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, ...options }),
    signal,
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
    } catch {
      /* not JSON */
    }
    throw new Error(`Request failed (${response.status}): ${detail}`);
  }
  if (!response.body) {
    throw new Error("Claude Code response had no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flushLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      handlers.onEvent(JSON.parse(trimmed) as ClaudeCodeEvent);
    } catch {
      // skip malformed lines silently
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lastNewline = buffer.lastIndexOf("\n");
      if (lastNewline < 0) continue;

      const complete = buffer.slice(0, lastNewline);
      buffer = buffer.slice(lastNewline + 1);
      for (const line of complete.split("\n")) flushLine(line);
    }
    if (buffer) flushLine(buffer);
  } finally {
    reader.releaseLock();
  }
}

export const api = {
  hello: () => http<{ message: string }>("/api/hello"),
  getConfig: () => http<UiConfig>("/api/config"),
  sendMessage: (message: string) =>
    http<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  executeClaudeCode,
};
