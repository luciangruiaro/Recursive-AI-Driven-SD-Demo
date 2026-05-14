import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useConfig } from "@/hooks/useConfig";
import type { UiConfig } from "@/types";

const sampleConfig: UiConfig = {
  title: "Title",
  subtitle: "Subtitle",
  placeholder: "Ask…",
  theme: {
    font_sans: "Inter",
    font_mono: "JB Mono",
    colors: {
      background: "#000",
      surface: "#111",
      surface_elevated: "#222",
      border: "#333",
      text_primary: "#fff",
      text_secondary: "#ccc",
      text_muted: "#999",
      primary: "#f0f",
      primary_hover: "#f9f",
      accent: "#0ff",
      success: "#0f0",
      error: "#f00",
    },
  },
};

describe("useConfig", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts loading, then resolves to the fetched config", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(sampleConfig), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => useConfig());

    expect(result.current.loading).toBe(true);
    expect(result.current.config).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config).toEqual(sampleConfig);
    expect(result.current.error).toBeNull();
  });

  it("captures an error message when the request fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "unreachable" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => useConfig());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config).toBeNull();
    expect(result.current.error).toMatch(/500|unreachable/);
  });
});
