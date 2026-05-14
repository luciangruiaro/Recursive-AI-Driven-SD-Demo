import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSelfEvolve } from "@/hooks/useSelfEvolve";

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

describe("useSelfEvolve", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useSelfEvolve());

    expect(result.current.status).toBe("idle");
    expect(result.current.events).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.prompt).toBeNull();
  });

  it("accumulates the happy-path event sequence and ends in done", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      ndjsonResponse([
        JSON.stringify({ type: "step", name: "read_config", ok: true }),
        JSON.stringify({ type: "step", name: "call_llm", ok: true }),
        JSON.stringify({
          type: "proposal",
          summary: "make background red",
          changes: [{ path: "ui.theme.colors.background", value: "#ff0000" }],
        }),
        JSON.stringify({ type: "step", name: "apply", ok: true }),
        JSON.stringify({
          type: "applied",
          changes: [
            {
              path: "ui.theme.colors.background",
              old_value: "#0a0a0f",
              new_value: "#ff0000",
            },
          ],
        }),
        JSON.stringify({ type: "done", applied: [], duration_ms: 123 }),
      ]),
    );

    const { result } = renderHook(() => useSelfEvolve());

    await act(async () => {
      await result.current.send("make it red");
    });

    expect(result.current.status).toBe("done");
    expect(result.current.events).toHaveLength(6);
    expect(result.current.events[2].type).toBe("proposal");
    expect(result.current.prompt).toBe("make it red");
  });

  it("ends in error status when the stream emits an error event", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      ndjsonResponse([
        JSON.stringify({ type: "step", name: "read_config", ok: true }),
        JSON.stringify({ type: "error", error: "LLM call failed: api down" }),
      ]),
    );

    const { result } = renderHook(() => useSelfEvolve());

    await act(async () => {
      await result.current.send("...");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toMatch(/LLM call failed/);
  });

  it("transitions to error on non-2xx response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ detail: "SELF_EVOLVE_TARGET_DIR is not set (see .env)" }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const { result } = renderHook(() => useSelfEvolve());

    await act(async () => {
      await result.current.send("...");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toMatch(/SELF_EVOLVE_TARGET_DIR/);
  });

  it("reset() returns to idle and clears events", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      ndjsonResponse([
        JSON.stringify({ type: "step", name: "read_config", ok: true }),
        JSON.stringify({ type: "done", applied: [], duration_ms: 1 }),
      ]),
    );

    const { result } = renderHook(() => useSelfEvolve());

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
