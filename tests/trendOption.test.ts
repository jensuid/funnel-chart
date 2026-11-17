import { describe, it, expect } from "vitest";
import {
  createTrendOption,
  trendPeriods,
  trendSeriesName,
} from "../src/funnel-analysis/charts/createTrendOption";
import { createTrendTooltipFormatter } from "../src/funnel-analysis/charts/tooltipFormatter";
import { computeTransitions } from "../src/funnel-analysis/metrics/calculateFunnelMetrics";
import { buildTrend } from "../src/funnel-analysis/metrics/aggregateTrendMetrics";
import { normalizeFunnelData } from "../src/funnel-analysis/adapters/normalizeFunnelData";
import { stageColor } from "../src/funnel-analysis/charts/chartTheme";
import {
  incompleteFixture,
  standardFunnelFixture,
} from "./fixtures";

const normalized = normalizeFunnelData(standardFunnelFixture);
const placeholderVms = normalized.stages.map((stage) => ({
  stage,
  count: 0,
  cumulativeConversion: null,
  stageToStageConversion: null,
  dropOff: null,
}));
const transitions = computeTransitions(placeholderVms);
const { trend } = buildTrend(normalized, transitions, "weekly");

function buildOption(overrides: Record<string, unknown> = {}) {
  return createTrendOption({
    trend,
    transitions,
    stages: normalized.stages,
    visibleSeriesIds: transitions.map((t) => t.id),
    highlightedTransitionIds: [],
    ...overrides,
  }) as Record<string, unknown> & { series: Record<string, unknown>[] };
}

describe("createTrendOption — series mapping", () => {
  it("creates one line series per transition, keyed by transition ID", () => {
    const option = buildOption();
    expect(option.series.length).toBe(transitions.length);
    expect(option.series.map((s) => s.id)).toEqual([
      "visitors->views",
      "views->cart",
      "cart->checkout",
      "checkout->purchase",
    ]);
    expect(option.series.every((s) => s.type === "line")).toBe(true);
  });

  it("series are built by transition ID, not array position", () => {
    const option = buildOption();
    const byId = new Map(option.series.map((s) => [s.id, s]));
    expect(byId.get("checkout->purchase")).toBeDefined();
    expect((byId.get("checkout->purchase") as { name: string }).name).toBe(
      "Checkout → Purchase",
    );
  });

  it("series color = destination stage color (D2)", () => {
    const option = buildOption();
    const checkoutToPurchase = option.series.find(
      (s) => s.id === "checkout->purchase",
    )!;
    expect(
      (checkoutToPurchase.itemStyle as { color: string }).color,
    ).toBe(stageColor(4)); // purchase = amber
    const visitorsToViews = option.series.find((s) => s.id === "visitors->views")!;
    expect((visitorsToViews.itemStyle as { color: string }).color).toBe(
      stageColor(1),
    ); // views = cyan
  });
});

describe("createTrendOption — axes and gaps", () => {
  it("y-axis fixed 0–100 with % labels", () => {
    const option = buildOption();
    const yAxis = option.yAxis as { min: number; max: number; axisLabel: { formatter: string } };
    expect(yAxis.min).toBe(0);
    expect(yAxis.max).toBe(100);
    expect(yAxis.axisLabel.formatter).toBe("{value}%");
  });

  it("x-axis uses sorted period buckets", () => {
    const option = buildOption();
    expect((option.xAxis as { data: string[] }).data).toEqual([
      "2026-W01",
      "2026-W02",
    ]);
  });

  it("connectNulls defaults to false", () => {
    const option = buildOption();
    expect(option.series.every((s) => s.connectNulls === false)).toBe(true);
  });

  it("missing periods are null gaps, not zero (incomplete fixture)", () => {
    const inc = normalizeFunnelData(incompleteFixture);
    const { trend: incTrend } = buildTrend(inc, transitions, "weekly");
    const option = createTrendOption({
      trend: incTrend,
      transitions,
      stages: inc.stages,
      visibleSeriesIds: transitions.map((t) => t.id),
      highlightedTransitionIds: [],
    }) as { series: Record<string, unknown>[] };

    const cartToCheckout = option.series.find((s) => s.id === "cart->checkout")!;
    expect(cartToCheckout.data).toEqual([50, null]); // W02 gap → null
  });
});

describe("createTrendOption — legend and selection", () => {
  it("legend.selected reflects visibleSeriesIds keyed by series name; hidden series stay in option", () => {
    const option = buildOption({
      visibleSeriesIds: ["visitors->views", "checkout->purchase"],
    });
    const legend = option.legend as { selected: Record<string, boolean> };
    expect(legend.selected).toEqual({
      "Visitors → Views": true,
      "Views → Cart": false,
      "Cart → Checkout": false,
      "Checkout → Purchase": true,
    });
    // Visibility ≠ removal — all four series remain.
    expect(option.series.length).toBe(4);
  });

  it("highlighting emphasizes the chosen series and subdues the rest", () => {
    const option = buildOption({ highlightedTransitionIds: ["views->cart"] });
    const selected = option.series.find((s) => s.id === "views->cart")!;
    const other = option.series.find((s) => s.id === "visitors->views")!;
    expect(
      (selected.lineStyle as { width: number }).width,
    ).toBeGreaterThan((other.lineStyle as { width: number }).width);
    expect((other.lineStyle as { opacity?: number }).opacity).toBe(0.25);
    expect((selected.lineStyle as { opacity?: number }).opacity).toBeUndefined();
  });
});

describe("createTrendOption — config overrides", () => {
  it("applies smooth, area, line width, symbol size and zoom", () => {
    const option = buildOption({
      config: {
        smooth: true,
        showArea: true,
        lineWidth: 2,
        symbolSize: 8,
        showZoom: true,
        legendPosition: "bottom",
      },
    });
    const first = option.series[0]!;
    expect(first.smooth).toBe(true);
    expect(first.symbolSize).toBe(8);
    expect((first.lineStyle as { width: number }).width).toBe(2);
    expect(first.areaStyle).toBeDefined();
    expect(option.dataZoom).toBeDefined();
    expect((option.legend as { bottom?: number }).bottom).toBe(0);
  });
});

describe("trendPeriods and trendSeriesName", () => {
  it("returns sorted unique periods", () => {
    expect(trendPeriods(trend)).toEqual(["2026-W01", "2026-W02"]);
  });

  it("names series from stage labels", () => {
    const t = transitions[0]!;
    expect(trendSeriesName(t, normalized.stages)).toBe("Visitors → Views");
  });
});

describe("trend tooltip formatter", () => {
  const seriesMeta = transitions.map((t, i) => ({
    id: t.id,
    name: trendSeriesName(t, normalized.stages),
    color: stageColor(i + 1),
  }));

  it("shows all visible series for the period, in transition order", () => {
    const formatter = createTrendTooltipFormatter({
      seriesMeta,
      visibleSeriesIds: transitions.map((t) => t.id),
    });
    const html = formatter([
      { seriesId: "visitors->views", axisValue: "2026-W01", value: 70 },
      { seriesId: "checkout->purchase", axisValue: "2026-W01", value: 40 },
      { seriesId: "views->cart", axisValue: "2026-W01", value: 50 },
      { seriesId: "cart->checkout", axisValue: "2026-W01", value: 50 },
    ]) as unknown as string;
    expect(html).toContain("2026-W01");
    expect(html.indexOf("Visitors → Views")).toBeLessThan(html.indexOf("Views → Cart"));
    expect(html).toContain("70.0%");
    expect(html).toContain("40.0%");
  });

  it("excludes legend-disabled series", () => {
    const formatter = createTrendTooltipFormatter({
      seriesMeta,
      visibleSeriesIds: ["visitors->views"],
    });
    const html = formatter([
      { seriesId: "visitors->views", axisValue: "2026-W01", value: 70 },
      { seriesId: "views->cart", axisValue: "2026-W01", value: 50 },
    ]) as unknown as string;
    expect(html).toContain("Visitors → Views");
    expect(html).not.toContain("Views → Cart");
  });

  it("renders null rates as — (gap), never 0%", () => {
    const formatter = createTrendTooltipFormatter({
      seriesMeta,
      visibleSeriesIds: transitions.map((t) => t.id),
    });
    const html = formatter([
      { seriesId: "visitors->views", axisValue: "2026-W02", value: 70 },
      { seriesId: "cart->checkout", axisValue: "2026-W02", value: null },
    ]) as unknown as string;
    expect(html).toContain("—");
    expect(html).not.toContain(">0.0%");
  });
});
