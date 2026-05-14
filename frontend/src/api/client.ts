/** Thin HTTP client. In dev all requests are relative — the Vite proxy
 *  forwards `/api/*` to the backend. In prod, set `VITE_API_BASE_URL`. */

import type { ChatResponse, UiConfig } from "@/types";

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

export const api = {
  hello: () => http<{ message: string }>("/api/hello"),
  getConfig: () => http<UiConfig>("/api/config"),
  sendMessage: (message: string) =>
    http<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};
