import { useEffect, useState } from "react";

import { api } from "@/api/client";
import type { UiConfig } from "@/types";

interface ConfigState {
  config: UiConfig | null;
  error: string | null;
  loading: boolean;
}

export function useConfig(): ConfigState {
  const [state, setState] = useState<ConfigState>({
    config: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    api
      .getConfig()
      .then((config) => {
        if (!cancelled) setState({ config, error: null, loading: false });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Unknown error";
        setState({ config: null, error: message, loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
