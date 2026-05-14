import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useConfig } from "@/hooks/useConfig";
import type { UiConfig } from "@/types";

// ─── Fake EventSource ────────────────────────────────────────────────────────
// happy-dom doesn't ship a usable EventSource; we stub a minimal one that lets
// tests drive `onmessage` / `onerror` manually.

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close = vi.fn();

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  emit(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  fail(): void {
    this.onerror?.(new Event("error"));
  }
}

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
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts loading, then resolves on the first stream event", async () => {
    const { result } = renderHook(() => useConfig());

    expect(result.current.loading).toBe(true);
    expect(result.current.config).toBeNull();
    expect(FakeEventSource.instances).toHaveLength(1);

    act(() => {
      FakeEventSource.instances[0].emit(sampleConfig);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config).toEqual(sampleConfig);
    expect(result.current.error).toBeNull();
  });

  it("applies subsequent stream events (live reload)", async () => {
    const { result } = renderHook(() => useConfig());

    act(() => FakeEventSource.instances[0].emit(sampleConfig));
    await waitFor(() => expect(result.current.config?.title).toBe("Title"));

    const updated: UiConfig = { ...sampleConfig, title: "Updated!" };
    act(() => FakeEventSource.instances[0].emit(updated));

    await waitFor(() => expect(result.current.config?.title).toBe("Updated!"));
    expect(result.current.error).toBeNull();
  });

  it("surfaces an error if the initial connection fails", async () => {
    const { result } = renderHook(() => useConfig());

    act(() => FakeEventSource.instances[0].fail());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/cannot connect/i);
    expect(result.current.config).toBeNull();
  });

  it("ignores transient errors once a config has been loaded", async () => {
    const { result } = renderHook(() => useConfig());

    act(() => FakeEventSource.instances[0].emit(sampleConfig));
    await waitFor(() => expect(result.current.config).not.toBeNull());

    // Pretend the connection dropped briefly; EventSource will reconnect.
    act(() => FakeEventSource.instances[0].fail());

    expect(result.current.config).toEqual(sampleConfig);
    expect(result.current.error).toBeNull();
  });

  it("closes the EventSource on unmount", async () => {
    const { unmount } = renderHook(() => useConfig());
    const instance = FakeEventSource.instances[0];

    unmount();

    expect(instance.close).toHaveBeenCalledOnce();
  });
});
