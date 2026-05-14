import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThemeProvider } from "@/theme/ThemeProvider";
import type { Theme } from "@/types";

const theme: Theme = {
  font_sans: "Inter, sans-serif",
  font_mono: "JB Mono, monospace",
  colors: {
    background: "#0a0a0f",
    surface: "#12121a",
    surface_elevated: "#1a1a26",
    border: "#26263a",
    text_primary: "#f5f5fa",
    text_secondary: "#9ca3af",
    text_muted: "#6b7280",
    primary: "#8b5cf6",
    primary_hover: "#a78bfa",
    accent: "#06b6d4",
    success: "#10b981",
    error: "#ef4444",
  },
};

describe("<ThemeProvider />", () => {
  it("writes font and color tokens onto :root as CSS custom properties", () => {
    render(
      <ThemeProvider theme={theme}>
        <div>child</div>
      </ThemeProvider>,
    );

    const root = document.documentElement.style;

    expect(root.getPropertyValue("--font-sans")).toBe("Inter, sans-serif");
    expect(root.getPropertyValue("--font-mono")).toBe("JB Mono, monospace");

    // Spot-check a few colors, including a snake_case → kebab-case translation
    expect(root.getPropertyValue("--color-background")).toBe("#0a0a0f");
    expect(root.getPropertyValue("--color-primary")).toBe("#8b5cf6");
    expect(root.getPropertyValue("--color-surface-elevated")).toBe("#1a1a26");
    expect(root.getPropertyValue("--color-text-secondary")).toBe("#9ca3af");
  });

  it("renders its children unchanged", () => {
    const { getByText } = render(
      <ThemeProvider theme={theme}>
        <p>visible content</p>
      </ThemeProvider>,
    );

    expect(getByText("visible content")).toBeInTheDocument();
  });
});
