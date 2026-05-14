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
