/** Applies the backend-supplied theme to the document root as CSS variables.
 *  All components consume the theme via `var(--color-*)` / `var(--font-*)`. */

import { useLayoutEffect, type ReactNode } from "react";

import type { Theme } from "@/types";

interface ThemeProviderProps {
  theme: Theme;
  children: ReactNode;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  useLayoutEffect(() => {
    const root = document.documentElement;

    root.style.setProperty("--font-sans", theme.font_sans);
    root.style.setProperty("--font-mono", theme.font_mono);

    for (const [key, value] of Object.entries(theme.colors)) {
      // background -> --color-background, surface_elevated -> --color-surface-elevated
      const cssName = `--color-${key.replace(/_/g, "-")}`;
      root.style.setProperty(cssName, value);
    }
  }, [theme]);

  return <>{children}</>;
}
