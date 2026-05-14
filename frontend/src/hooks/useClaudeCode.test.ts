import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useClaudeCode } from "@/hooks/useClaudeCode";

/** Build a Response whose body is an ndjson stream of the given lines. */
function ndjsonResponse(lines: string[], init: ResponseInit = {}): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line + "\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
    ...init,
  });
}

describe("useClaudeCode", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useClaudeCode());

    expect(result.current.status).toBe("idle");
    expect(result.current.events).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.prompt).toBeNull();
  });

  it("accumulates streamed events and ends in done state", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      ndjsonResponse([
        JSON.stringify({ type: "system", subtype: "init" }),
        JSON.stringify({
          type: "assistant",
          message: { role: "assistant", content: [{ type: "text", text: "hi" }] },
        }),
        JSON.stringify({ type: "result", result: "hi", is_error: false }),
      ]),
    );

    const { result } = renderHook(() => useClaudeCode());

    await act(async () => {
      await result.current.send("ping");
    });

    expect(result.current.status).toBe("done");
    expect(result.current.events).toHaveLength(3);
    expect(result.current.events[0].type).toBe("system");
    expect(result.current.events[1].type).toBe("assistant");
    expect(result.current.events[2].type).toBe("result");
    expect(result.current.prompt).toBe("ping");
  });

  it("captures the user's prompt for display", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(ndjsonResponse([]));

    const { result } = renderHook(() => useClaudeCode());

    await act(async () => {
      await result.current.send("do the thing");
    });

    expect(result.current.prompt).toBe("do the thing");
  });

  it("ignores malformed ndjson lines without crashing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      ndjsonResponse([
        "not-json",
        JSON.stringify({ type: "error", error: "boom" }),
        "",
      ]),
    );

    const { result } = renderHook(() => useClaudeCode());

    await act(async () => {
      await result.current.send("x");
    });

    expect(result.current.status).toBe("done");
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0]).toEqual({ type: "error", error: "boom" });
  });

  it("transitions to error on non-2xx response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ detail: "claude CLI not found on PATH" }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const { result } = renderHook(() => useClaudeCode());

    await act(async () => {
      await result.current.send("x");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toMatch(/claude CLI not found/);
  });

  it("reset() returns to idle and clears events", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      ndjsonResponse([
        JSON.stringify({
          type: "assistant",
          message: { role: "assistant", content: [{ type: "text", text: "x" }] },
        }),
      ]),
    );

    const { result } = renderHook(() => useClaudeCode());

    await act(async () => {
      await result.current.send("x");
    });
    expect(result.current.status).toBe("done");

    act(() => result.current.reset());

    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(result.current.events).toEqual([]);
    expect(result.current.prompt).toBeNull();
  });
});
