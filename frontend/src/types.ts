/** Backend-defined types. Keep this file aligned with `backend/app/config.py`
 *  and `backend/app/schemas.py`. */

export interface ThemeColors {
  background: string;
  surface: string;
  surface_elevated: string;
  border: string;
  text_primary: string;
  text_secondary: string;
  text_muted: string;
  primary: string;
  primary_hover: string;
  accent: string;
  success: string;
  error: string;
}

export interface Theme {
  font_sans: string;
  font_mono: string;
  colors: ThemeColors;
}

export interface UiConfig {
  title: string;
  subtitle: string;
  placeholder: string;
  theme: Theme;
}

export interface ChatResponse {
  content: string;
  model: string;
}

// ─── Claude Code CLI bridge ───────────────────────────────────────────────────
// The shape of an event in the ndjson stream coming from `claude --output-format
// stream-json`. We model only what the UI cares about.

export type ClaudeCodeContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string | unknown[];
      is_error?: boolean;
    };

export interface ClaudeCodeMessage {
  role: "assistant" | "user";
  content: ClaudeCodeContentBlock[];
}

export type ClaudeCodeEvent =
  | {
      type: "system";
      subtype?: string;
      session_id?: string;
      cwd?: string;
      tools?: string[];
      model?: string;
    }
  | { type: "assistant"; message: ClaudeCodeMessage }
  | { type: "user"; message: ClaudeCodeMessage }
  | {
      type: "result";
      subtype?: string;
      result?: string;
      is_error?: boolean;
      duration_ms?: number;
      total_cost_usd?: number;
    }
  | { type: "error"; error: string };

export interface ClaudeCodeOptions {
  allowed_tools?: string[];
  max_turns?: number;
  timeout_seconds?: number;
  idle_timeout_seconds?: number;
  skip_permissions?: boolean;
  system_prompt?: string;
  session_id?: string;
}
