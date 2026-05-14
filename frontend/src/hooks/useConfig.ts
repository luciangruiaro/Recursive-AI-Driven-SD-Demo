import { useEffect, useState } from "react";

import type { UiConfig } from "@/types";

interface ConfigState {
  config: UiConfig | null;
  error: string | null;
  loading: boolean;
}

const initial: ConfigState = { config: null, error: null, loading: true };

/** Live UI config via SSE.
 *
 *  Connects to ``/api/config/stream`` on mount. The first event arrives
 *  immediately on connect (the current config). Subsequent events fire every
 *  time the backend reloads ``config.toml``. EventSource auto-reconnects on
 *  transient drops, so we only surface an error when we never got a config
 *  in the first place. */
export function useConfig(): ConfigState {
  const [state, setState] = useState<ConfigState>(initial);

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
    const source = new EventSource(`${baseUrl}/api/config/stream`);

    source.onmessage = (event) => {
      try {
        const config = JSON.parse(event.data) as UiConfig;
        setState({ config, error: null, loading: false });
      } catch (e) {
        console.warn("[config] failed to parse event:", e);
      }
    };

    source.onerror = () => {
      // Only surface as error if we never got a config; otherwise rely on
      // EventSource's built-in reconnection and keep showing the cached one.
      setState((s) =>
        s.config
          ? s
          : {
              config: null,
              error: "Cannot connect to config stream",
              loading: false,
            },
      );
    };

    return () => source.close();
  }, []);

  return state;
}
