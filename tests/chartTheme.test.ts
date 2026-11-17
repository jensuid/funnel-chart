import { describe, it, expect } from "vitest";
import {
  interpolateColor,
  monochromeRamp,
  resolveStagePalette,
  barGradient,
  DEFAULT_STAGE_COLORS,
} from "../src/funnel-analysis/charts/chartTheme";

describe("interpolateColor", () => {
  it("returns endpoints unchanged at t=0 and t=1", () => {
    expect(interpolateColor("#000000", "#FFFFFF", 0)).toBe("#000000");
    expect(interpolateColor("#000000", "#FFFFFF", 1)).toBe("#ffffff");
  });

  it("midpoint of black/white is mid gray", () => {
    expect(interpolateColor("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  });
});

describe("monochromeRamp", () => {
  it("single stage returns just the base color", () => {
    expect(monochromeRamp("#3B82F6", 1)).toEqual(["#3B82F6"]);
  });

  it("ramp starts light, passes through the base, ends dark", () => {
    const ramp = monochromeRamp("#3B82F6", 5);
    expect(ramp).toHaveLength(5);
    // Light tint at the start (close to white).
    const lum = (hex: string) => parseInt(hex.slice(1, 3), 16);
    expect(lum(ramp[0]!)).toBeGreaterThan(lum("#3B82F6"));
    // Middle is the base color itself (t=0.5).
    expect(ramp[2]).toBe("#3b82f6");
    // Dark shade at the end (darker than base).
    expect(lum(ramp[4]!)).toBeLessThan(lum("#3B82F6"));
  });

  it("is monotonic in lightness for blue channel direction", () => {
    const ramp = monochromeRamp("#3B82F6", 8);
    const lum = (hex: string) => parseInt(hex.slice(1, 3), 16);
    for (let i = 1; i < ramp.length; i++) {
      expect(lum(ramp[i]!)).toBeLessThanOrEqual(lum(ramp[i - 1]!));
    }
  });
});

describe("resolveStagePalette", () => {
  it("defaults to the brand palette", () => {
    expect(resolveStagePalette(5)).toEqual([...DEFAULT_STAGE_COLORS]);
  });

  it("funnel.colorPalette wins over theme.stageColors", () => {
    const palette = resolveStagePalette(3, { stageColors: ["#111111"] }, {
      colorPalette: ["#222222", "#333333", "#444444"],
    });
    expect(palette).toEqual(["#222222", "#333333", "#444444"]);
  });

  it("ramp mode with baseColor overrides any palette", () => {
    const ramp = resolveStagePalette(5, { stageColors: ["#111111"] }, {
      colorMode: "ramp",
      baseColor: "#EF4444",
    });
    expect(ramp).toHaveLength(5);
    expect(ramp[2]).toBe("#ef4444"); // middle of odd-length ramp = base
  });

  it("ramp without baseColor falls back to palette (not a broken ramp)", () => {
    expect(resolveStagePalette(3, undefined, { colorMode: "ramp" })).toEqual([
      ...DEFAULT_STAGE_COLORS,
    ]);
  });
});

describe("barGradient", () => {
  it("vertical gradient runs top→bottom", () => {
    const g = barGradient("#3B82F6", "vertical") as {
      x2: number;
      y2: number;
      colorStops: { offset: number; color: string }[];
    };
    expect(g.y2).toBe(1);
    expect(g.x2).toBe(0);
    expect(g.colorStops[0]!.color).toBe("#3B82F6");
    expect(g.colorStops[1]!.color).not.toBe("#3B82F6"); // lighter variant
  });

  it("horizontal gradient runs left→right", () => {
    const g = barGradient("#3B82F6", "horizontal") as { x2: number; y2: number };
    expect(g.x2).toBe(1);
    expect(g.y2).toBe(0);
  });
});
