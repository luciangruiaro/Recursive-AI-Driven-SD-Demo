import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api/client";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("api client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GETs /api/config and returns the parsed body", async () => {
    const config = { title: "T", subtitle: "S", placeholder: "P" };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(config));

    const result = await api.getConfig();

    expect(result).toEqual(config);
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe("/api/config");
    expect(init?.method).toBeUndefined(); // default GET
  });

  it("POSTs the user message as JSON to /api/chat", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ content: "ok", model: "gpt-4o-mini" }),
    );

    const result = await api.sendMessage("Hello");

    expect(result).toEqual({ content: "ok", model: "gpt-4o-mini" });
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe("/api/chat");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ message: "Hello" });
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
  });

  it("throws an error including the backend detail on failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "OPENAI_API_KEY missing" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const error = await api.sendMessage("hi").catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/503/);
    expect((error as Error).message).toMatch(/OPENAI_API_KEY/);
  });

  it("falls back to statusText if the error body is not JSON", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("not json", { status: 500, statusText: "Server Error" }),
    );

    await expect(api.getConfig()).rejects.toThrow(/500/);
  });
});
