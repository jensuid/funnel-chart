import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { FunnelAnalysis } from "../src/funnel-analysis/components/FunnelAnalysis";
import {
  standardFunnelFixture,
  zeroVolumeFixture,
  incompleteFixture,
} from "./fixtures";
import {
  DEFAULT_STAGE_COLORS,
  accessibleStroke,
  resolveTheme,
} from "../src/funnel-analysis/charts/chartTheme";

afterEach(cleanup);

/** WCAG 2.2 relative luminance. */
function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const rgb = [0, 1, 2].map((i) => {
    const v = parseInt(c.slice(i * 2, i * 2 + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
}

function contrast(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

describe("Accessibility — WCAG 2.2 AA contrast", () => {
  it("text tokens meet 4.5:1 on their background (light and dark)", () => {
    for (const theme of [undefined, { mode: "dark" as const }]) {
      const t = resolveTheme(theme);
      expect(contrast(t.textColor, t.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.mutedTextColor, t.background)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it("brand palette fills keep their hue; accessible strokes meet 3:1 (WCAG 1.4.11)", () => {
    // Palette is locked by DATA-CONTRACT — fills keep brand hues even where
    // they fall below 3:1 on white; graphics carry an accessible stroke.
    for (let i = 0; i < DEFAULT_STAGE_COLORS.length; i++) {
      const stroke = accessibleStroke(i);
      expect(contrast(stroke, "#FFFFFF")).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("Accessibility — landmarks, labels, fallback table", () => {
  it("exposes labelled regions for each panel", () => {
    render(<FunnelAnalysis data={standardFunnelFixture} />);
    expect(screen.getByLabelText("Funnel overview")).toBeTruthy();
    expect(screen.getByLabelText("Key insights")).toBeTruthy();
    expect(screen.getByLabelText("Conversion rate trend")).toBeTruthy();
    expect(screen.getByLabelText("Trend summary")).toBeTruthy();
  });

  it("data table fallback is the primary a11y mechanism for the chart", () => {
    render(
      <FunnelAnalysis data={standardFunnelFixture} config={{ showDataTable: true }} />,
    );
    const table = screen.getByRole("table", { name: "Funnel data table" });
    // Every stage appears as a row header with its metrics.
    for (const s of standardFunnelFixture.stages) {
      expect(table.textContent).toContain(s.label);
    }
    expect(table.textContent).toContain("100.0%");
  });

  it("alert states use role=alert; progress uses aria-live/status", () => {
    const bad = {
      ...standardFunnelFixture,
      periods: [
        { period: "2026-W01", stages: [{ stageId: "visitors", count: -3 }] },
      ],
    };
    const { unmount } = render(<FunnelAnalysis data={bad} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    unmount();

    const { unmount: u2 } = render(
      <FunnelAnalysis data={standardFunnelFixture} loading />,
    );
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy();
    u2();

    render(<FunnelAnalysis data={incompleteFixture} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("zero-volume renders em dashes, never NaN, for screen readers", () => {
    const { container } = render(
      <FunnelAnalysis data={zeroVolumeFixture} config={{ showDataTable: true }} />,
    );
    expect(container.textContent).toContain("—");
    expect(container.textContent).not.toContain("NaN");
  });
});
