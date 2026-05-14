import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChat } from "@/hooks/useChat";

describe("useChat", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useChat());

    expect(result.current.status).toBe("idle");
    expect(result.current.response).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("transitions idle → loading → success on a happy response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ content: "## Hi", model: "gpt-4o-mini" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { result } = renderHook(() => useChat());

    act(() => {
      void result.current.send("hello");
    });

    // Eventually success
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.response).toBe("## Hi");
    expect(result.current.model).toBe("gpt-4o-mini");
    expect(result.current.error).toBeNull();
  });

  it("transitions to error state when the backend rejects", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "boom" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.send("hello");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toMatch(/boom/);
    expect(result.current.response).toBeNull();
  });

  it("reset() returns to idle", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ content: "x", model: "m" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.send("hi");
    });
    expect(result.current.status).toBe("success");

    act(() => result.current.reset());
    expect(result.current.status).toBe("idle");
    expect(result.current.response).toBeNull();
  });
});
