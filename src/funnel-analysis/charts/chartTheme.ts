import type { FunnelAnalysisTheme, FunnelChartConfig } from "../types/api.types";

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
export function stageColor(
  index: number,
  theme?: FunnelAnalysisTheme,
  palette?: string[],
): string {
  const p = palette ?? theme?.stageColors ?? DEFAULT_STAGE_COLORS;
  const i = ((index % p.length) + p.length) % p.length;
  return p[i] ?? DEFAULT_STAGE_COLORS[0]!;
}

// ---------------------------------------------------------------------------
// Color customization: interpolation, monochrome ramps, effective palette
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  const full =
    c.length === 3
      ? c
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : c;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Linear interpolation between two hex colors (t=0 → a, t=1 → b). */
export function interpolateColor(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
  const ch = [r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t].map(clamp);
  return `#${ch.map((v) => (v as number).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Monochrome ramp — one base color swept from a light tint through the base
 * itself to a darker shade. Ideal for funnels: the gradient reinforces the
 * stage progression without requiring the caller to hand-pick N colors.
 * `direction` controls which end of the funnel gets the light tint.
 */
export function monochromeRamp(
  baseColor: string,
  steps: number,
  direction: "light-to-dark" | "dark-to-light" = "light-to-dark",
): string[] {
  if (steps <= 1) return [baseColor];
  const light = interpolateColor(baseColor, "#FFFFFF", 0.78);
  const dark = interpolateColor(baseColor, "#000000", 0.35);
  const ramp = Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return t <= 0.5
      ? interpolateColor(light, baseColor, t * 2)
      : interpolateColor(baseColor, dark, (t - 0.5) * 2);
  });
  return direction === "dark-to-light" ? ramp.reverse() : ramp;
}

/**
 * Effective stage palette — single source of truth for funnel fill, trend
 * lines and transition colors (D2). Priority:
 *   ramp mode (colorMode + baseColor)  >  funnel.colorPalette  >
 *   theme.stageColors  >  DEFAULT_STAGE_COLORS.
 */
export function resolveStagePalette(
  stageCount: number,
  theme?: FunnelAnalysisTheme,
  funnel?: Pick<
    FunnelChartConfig,
    "colorPalette" | "colorMode" | "baseColor" | "rampDirection"
  >,
): string[] {
  if (funnel?.colorMode === "ramp" && funnel.baseColor) {
    return monochromeRamp(
      funnel.baseColor,
      Math.max(1, stageCount),
      funnel.rampDirection ?? "light-to-dark",
    );
  }
  return funnel?.colorPalette ?? theme?.stageColors ?? [...DEFAULT_STAGE_COLORS];
}

/**
 * Readable text color on a given background — picks white or near-black,
 * whichever has the higher WCAG contrast. Needed for inside labels on
 * light fills (e.g. the light end of a monochrome ramp).
 */
export function readableTextColor(
  bg: string,
  dark = "#111827",
  light = "#FFFFFF",
): string {
  return contrastRatio(light, bg) >= contrastRatio(dark, bg) ? light : dark;
}

/** WCAG 1.4.11: per-bar linear gradient (stage color → lighter variant). */
export function barGradient(
  color: string,
  orient: "vertical" | "horizontal",
): Record<string, unknown> {
  const lighter = interpolateColor(color, "#FFFFFF", 0.45);
  return orient === "vertical"
    ? {
        type: "linear",
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color },
          { offset: 1, color: lighter },
        ],
      }
    : {
        type: "linear",
        x: 0,
        y: 0,
        x2: 1,
        y2: 0,
        colorStops: [
          { offset: 0, color },
          { offset: 1, color: lighter },
        ],
      };
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
  palette?: string[],
): string {
  const base = stageColor(index, theme, palette);
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
  palette?: string[],
): string {
  return stageColor(toStageIndex, theme, palette);
}
