import type { FunnelAnalysisTheme } from "../types/api.types";

/**
 * Design tokens + default palette.
 *
 * D2: transition color = color of the DESTINATION stage (toStageId).
 * Stage order 1..5 maps to this palette; palettes are interpolated/repeated
 * for funnels with more stages. `theme.stageColors` overrides.
 */
export const DEFAULT_STAGE_COLORS = [
  "#3B82F6", // 1 Blue
  "#06B6D4", // 2 Cyan
  "#14B8A6", // 3 Teal
  "#22C55E", // 4 Green
  "#F59E0B", // 5 Amber
] as const;

export interface ThemeTokens {
  background: string;
  textColor: string;
  mutedTextColor: string;
  gridColor: string;
  borderRadius: number;
  fontFamily: string;
}

const LIGHT_TOKENS: ThemeTokens = {
  background: "#FFFFFF",
  textColor: "#111827",
  mutedTextColor: "#6B7280",
  gridColor: "#E5E7EB",
  borderRadius: 8,
  fontFamily:
    "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

const DARK_TOKENS: ThemeTokens = {
  background: "#111827",
  textColor: "#F9FAFB",
  mutedTextColor: "#9CA3AF",
  gridColor: "#374151",
  borderRadius: 8,
  fontFamily: LIGHT_TOKENS.fontFamily,
};

export function resolveTheme(theme?: FunnelAnalysisTheme): ThemeTokens {
  const base = theme?.mode === "dark" ? DARK_TOKENS : LIGHT_TOKENS;
  return {
    background: theme?.background ?? base.background,
    textColor: theme?.textColor ?? base.textColor,
    mutedTextColor: theme?.mutedTextColor ?? base.mutedTextColor,
    gridColor: theme?.gridColor ?? base.gridColor,
    borderRadius: theme?.borderRadius ?? base.borderRadius,
    fontFamily: theme?.fontFamily ?? base.fontFamily,
  };
}

/** Stage color by 0-based index; repeats palette for longer funnels. */
export function stageColor(index: number, theme?: FunnelAnalysisTheme): string {
  const palette = theme?.stageColors ?? DEFAULT_STAGE_COLORS;
  const i = ((index % palette.length) + palette.length) % palette.length;
  const color = palette[i];
  return color ?? DEFAULT_STAGE_COLORS[0]!;
}

/** Blend a hex color toward black by `amount` (0..1). */
export function darken(hex: string, amount: number): string {
  const c = hex.replace("#", "");
  const ch = [0, 1, 2]
    .map((i) => Math.round(parseInt(c.slice(i * 2, i * 2 + 2), 16) * (1 - amount)))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  return `#${ch}`;
}

/** WCAG 2.2 relative contrast ratio between two hex colors. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string): number => {
    const c = hex.replace("#", "");
    const rgb = [0, 1, 2].map((i) => {
      const v = parseInt(c.slice(i * 2, i * 2 + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
  };
  const l1 = lum(a);
  const l2 = lum(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * WCAG 1.4.11 non-text contrast: funnel bars / trend lines sit on a light
 * background, but some palette hues (cyan, teal, green, amber) fall below
 * 3:1 against white. The brand palette stays locked (DATA-CONTRACT), so
 * graphics get a darkened stroke that meets 3:1 while the fill keeps the
 * brand hue.
 */
export function accessibleStroke(
  index: number,
  theme?: FunnelAnalysisTheme,
  background = "#FFFFFF",
): string {
  const base = stageColor(index, theme);
  let amount = 0;
  let color = base;
  while (amount <= 0.6 && contrastRatio(color, background) < 3) {
    amount += 0.1;
    color = darken(base, amount);
  }
  return color;
}

/**
 * D2: transition i→i+1 takes the destination stage's color.
 * `toStageIndex` is 0-based.
 */
export function transitionColor(
  toStageIndex: number,
  theme?: FunnelAnalysisTheme,
): string {
  return stageColor(toStageIndex, theme);
}
