import { describe, it, expect } from "vitest";
import { createFunnelOption } from "../src/funnel-analysis/charts/createFunnelOption";
import { buildTransitionLabelSeries, createOutsideLabelLayout } from "../src/funnel-analysis/charts/dropOffIndicators";
import { resolveTheme, stageColor, transitionColor } from "../src/funnel-analysis/charts/chartTheme";
import { computeStageViewModels } from "../src/funnel-analysis/metrics/calculateFunnelMetrics";
import { standardFunnelFixture } from "./fixtures";

const week1 = standardFunnelFixture.periods[0]!;
const stageVms = computeStageViewModels(standardFunnelFixture.stages, week1.stages);

function buildOption(overrides: Record<string, unknown> = {}) {
  return createFunnelOption({
    stages: stageVms,
    selectedStageIds: [],
    hoveredStageId: null,
    ...overrides,
  });
}

describe("createFunnelOption — structure", () => {
  it("returns a funnel series with descending sort by default", () => {
    const option = buildOption() as { series: Record<string, unknown>[] };
    const main = option.series.find((s) => s.id === "funnel-stages")!;
    expect(main.type).toBe("funnel");
    expect(main.sort).toBe("descending");
    expect(main.orient).toBe("vertical");
    expect(main.gap).toBe(5);
  });

  it("funnel width represents volume: data values are counts", () => {
    const option = buildOption() as { series: Record<string, unknown>[] };
    const main = option.series.find((s) => s.id === "funnel-stages")!;
    const data = main.data as { value: number }[];
    expect(data.map((d) => d.value)).toEqual([1000, 700, 350, 175, 70]);
  });

  it("attaches cumulative conversion to each datum (D3 — view model labels)", () => {
    const option = buildOption() as { series: Record<string, unknown>[] };
    const main = option.series.find((s) => s.id === "funnel-stages")!;
    const data = main.data as { cumulativeConversion: number | null }[];
    const expected = [100, 70, 35, 17.5, 7];
    data.forEach((d, i) => {
      expect(d.cumulativeConversion).toBeCloseTo(expected[i]!, 10);
    });
  });

  it("overlay mirrors NON-default layout (horizontal, ascending, custom gap)", () => {
    const option = buildOption({
      config: {
        orientation: "horizontal",
        sort: "ascending",
        gap: 12,
        minSize: 10,
        maxSize: 90,
        showDropOffIndicators: true,
      },
    }) as { series: Record<string, unknown>[] };
    const overlay = option.series.find((s) => s.id === "funnel-transition-labels")!;
    const main = option.series.find((s) => s.id === "funnel-stages")!;
    for (const key of ["sort", "orient", "minSize", "maxSize", "gap"]) {
      expect(overlay[key]).toBe(main[key]);
    }
    expect(overlay.orient).toBe("horizontal");
    expect(overlay.sort).toBe("ascending");
    expect(overlay.gap).toBe(12);
  });

  it("adds a transparent transition-label series when showDropOffIndicators", () => {
    const option = buildOption() as { series: Record<string, unknown>[] };
    expect(option.series.length).toBe(2);
    const overlay = option.series.find((s) => s.id === "funnel-transition-labels")!;
    expect(overlay.type).toBe("funnel");
    expect(overlay.silent).toBe(true);
    // Aligned layout: identical sort/orient/min/max/gap with the main series.
    const main = option.series.find((s) => s.id === "funnel-stages")!;
    for (const key of ["sort", "orient", "minSize", "maxSize", "gap"]) {
      expect(overlay[key]).toBe(main[key]);
    }
  });

  it("omits the overlay when showDropOffIndicators is false", () => {
    const option = buildOption({ showDropOffIndicators: false }) as {
      series: Record<string, unknown>[];
    };
    expect(option.series.length).toBe(1);
  });

  it("marks the selected stage (border emphasis) without removing others", () => {
    const option = buildOption({ selectedStageIds: ["cart"] }) as {
      series: Record<string, unknown>[];
    };
    const main = option.series.find((s) => s.id === "funnel-stages")!;
    const data = main.data as {
      id: string;
      selected: boolean;
      itemStyle: { borderWidth?: number };
    }[];
    const cart = data.find((d) => d.id === "cart")!;
    const others = data.filter((d) => d.id !== "cart");
    expect(cart.selected).toBe(true);
    expect(cart.itemStyle.borderWidth).toBe(2);
    // Visibility ≠ selection: other stages remain in the data with the
    // 1px accessible stroke (WCAG 1.4.11), not the 2px selection border.
    expect(others.every((d) => !d.selected && d.itemStyle.borderWidth === 1)).toBe(true);
  });

  it("uses item tooltip", () => {
    const option = buildOption() as { tooltip: { trigger: string } };
    expect(option.tooltip.trigger).toBe("item");
  });

  it("respects custom gap and sort", () => {
    const option = buildOption({ config: { gap: 10, sort: "ascending" } }) as {
      series: Record<string, unknown>[];
    };
    const main = option.series.find((s) => s.id === "funnel-stages")!;
    expect(main.gap).toBe(10);
    expect(main.sort).toBe("ascending");
  });
});

describe("buildTransitionLabelSeries", () => {
  const tokens = resolveTheme();
  const overlay = buildTransitionLabelSeries({
    stages: stageVms,
    tokens,
    fontFamily: tokens.fontFamily,
    sort: "descending",
    orient: "vertical",
    minSize: 0,
    maxSize: 100,
    gap: 5,
  }) as { data: { incomingConversion: number | null; incomingDropOff: number | null }[] };

  it("first stage has no incoming transition", () => {
    expect(overlay.data[0]!.incomingConversion).toBeNull();
  });

  it("later stages carry their incoming transition metrics", () => {
    expect(overlay.data[1]!.incomingConversion).toBeCloseTo(70, 10);
    expect(overlay.data[4]!.incomingDropOff).toBeCloseTo(60, 10);
  });
});

describe("createFunnelOption — label placement", () => {
  it("outside labelPosition uses text color, not white (bug: invisible on white bg)", () => {
    const option = buildOption({
      config: { labelPosition: "outside" },
    }) as { series: Record<string, unknown>[] };
    const main = option.series.find((s) => s.id === "funnel-stages")!;
    const label = main.label as { color: string };
    expect(label.color).toBe("#111827"); // light theme textColor
  });

  it("auto strategy hides narrow bars' labels on the main series (overlay carries them)", () => {
    const option = buildOption({}) as { series: Record<string, unknown>[] };
    const main = option.series.find((s) => s.id === "funnel-stages")!;
    const data = main.data as { id: string; label?: { show: boolean; position: string } }[];
    // Counts 1000/700/350/175/70 → widths 100/70/35/17.5/7% of widest.
    // Adaptive default threshold for 5 stages = 15 → only "purchase" (7%) hidden.
    expect(data.find((d) => d.id === "visitors")!.label!.show).toBe(true);
    expect(data.find((d) => d.id === "purchase")!.label!.show).toBe(false);
  });

  it("outside threshold adapts to stage count (dense funnels move more labels out)", () => {
    const stages12 = Array.from({ length: 12 }, (_, i) => ({
      stage: { id: `s${i + 1}`, label: `Stage ${i + 1}`, order: i + 1 },
      count: Math.round(100000 / Math.pow(1.35, i)),
      cumulativeConversion: 100,
      stageToStageConversion: 50,
      dropOff: 50,
    })) as never;
    const option = createFunnelOption({
      stages: stages12,
      selectedStageIds: [],
      hoveredStageId: null,
    }) as { series: Record<string, unknown>[] };
    const main = option.series.find((s) => s.id === "funnel-stages")!;
    const data = main.data as { label?: { show: boolean } }[];
    const outsideCount = data.filter((d) => d.label!.show === false).length;
    // Adaptive threshold for 12 stages = 24% → stages at 22% and below move out.
    expect(outsideCount).toBeGreaterThanOrEqual(6);
    // Explicit config still wins over the adaptive default (threshold 5%
    // → only the two narrowest stages, 3.7% and 4.97%, move outside).
    const optionFixed = createFunnelOption({
      stages: stages12,
      selectedStageIds: [],
      hoveredStageId: null,
      config: { labelOutsideThreshold: 5 },
    }) as { series: Record<string, unknown>[] };
    const dataFixed = (optionFixed.series.find((s) => s.id === "funnel-stages")!
      .data as { label?: { show: boolean } }[]);
    expect(dataFixed.filter((d) => d.label!.show === false).length).toBe(2);
  });

  it("fixed strategy keeps every label at the configured position", () => {
    const option = buildOption({
      config: { labelStrategy: "fixed", labelPosition: "inside" },
    }) as { series: Record<string, unknown>[] };
    const main = option.series.find((s) => s.id === "funnel-stages")!;
    const data = main.data as { label?: { position: string } }[];
    expect(data.every((d) => d.label!.position === "inside")).toBe(true);
  });

  it("inside label color is contrast-aware (dark text on light ramp fills)", () => {
    const option = buildOption({
      config: { colorMode: "ramp", baseColor: "#3B82F6", labelStrategy: "fixed" },
    }) as { series: Record<string, unknown>[] };
    const main = option.series.find((s) => s.id === "funnel-stages")!;
    const data = main.data as { label?: { color: string } }[];
    // Lightest ramp fill (first stage) → dark text.
    expect(data[0]!.label!.color).toBe("#111827");
  });

  it("overlay takes over outside labels: shows the stage's own text there", () => {
    const option = buildOption({}) as {
      series: Record<string, unknown>[];
    };
    const overlay = option.series.find(
      (s) => s.id === "funnel-transition-labels",
    )!;
    const formatter = (overlay.label as { formatter: (p: { data?: unknown }) => string }).formatter;
    // purchase's label is carried by the overlay → its own text, not blank.
    const purchaseDatum = {
      stageId: "purchase",
      incomingConversion: 40,
      incomingDropOff: 60,
      takeoverText: "Purchase\n7.0%",
    };
    expect(formatter({ data: purchaseDatum })).toBe("Purchase\n7.0%");
    // cart keeps its drop-off metrics.
    const cartDatum = { stageId: "cart", incomingConversion: 50, incomingDropOff: 50 };
    expect(formatter({ data: cartDatum })).toContain("drop-off");
  });

  it("overlay uses custom stagger layout (stacked default)", () => {
    const option = buildOption({}) as { series: Record<string, unknown>[] };
    const main = option.series.find((s) => s.id === "funnel-stages")!;
    const overlay = option.series.find((s) => s.id === "funnel-transition-labels")!;
    // Main series (inside labels): plain hideOverlap.
    expect((main.labelLayout as { hideOverlap?: boolean }).hideOverlap).toBe(true);
    // Overlay (outside labels, vertical): custom stagger callback.
    expect(typeof overlay.labelLayout).toBe("function");
    expect((overlay.labelLine as { show: boolean }).show).toBe(true);
    // "aligned" arrangement falls back to hideOverlap without leader lines.
    const option2 = buildOption({
      config: { outsideLabelArrangement: "aligned" },
    }) as { series: Record<string, unknown>[] };
    const overlay2 = option2.series.find((s) => s.id === "funnel-transition-labels")!;
    expect((overlay2.labelLayout as { hideOverlap?: boolean }).hideOverlap).toBe(true);
    expect((overlay2.labelLine as { show: boolean }).show).toBe(false);
  });

  it("auto mode drops the count line on narrow bars (tiered content)", () => {
    const option = buildOption({}) as { series: Record<string, unknown>[] };
    const main = option.series.find((s) => s.id === "funnel-stages")!;
    const data = main.data as { id: string; labelText: string }[];
    // checkout is 17.5% wide → compact (name + % only, no count).
    expect(data.find((d) => d.id === "checkout")!.labelText).not.toContain("175");
    expect(data.find((d) => d.id === "checkout")!.labelText).toContain("17.5%");
    // visitors is widest → full label with count.
    expect(data.find((d) => d.id === "visitors")!.labelText).toContain("1,000");
  });

  it("overlay labels auto-hide above dropOffLabelMaxStages (drop-off only, takeover stays)", () => {
    const option = buildOption({
      config: { dropOffLabelMaxStages: 3 },
    }) as { series: Record<string, unknown>[] };
    const overlay = option.series.find((s) => s.id === "funnel-transition-labels")!;
    const data = overlay.data as { stageId: string; label?: { show: boolean } }[];
    // Drop-off metric labels suppressed (5 stages > 3)...
    expect(data.find((d) => d.stageId === "cart")!.label!.show).toBe(false);
    // ...but takeover stage labels always show.
    expect(data.find((d) => d.stageId === "purchase")!.label!.show).toBe(true);

    const option2 = buildOption({
      config: { dropOffLabelMaxStages: 8 },
    }) as { series: Record<string, unknown>[] };
    const overlay2 = option2.series.find((s) => s.id === "funnel-transition-labels")!;
    const data2 = overlay2.data as { label?: { show: boolean } }[];
    expect(data2.every((d) => d.label!.show)).toBe(true);
  });
});

describe("createOutsideLabelLayout (vertical funnel stagger)", () => {
  const data = [
    { stageId: "a", name: "A", value: 1000, incomingConversion: 90, incomingDropOff: 10, itemStyle: { color: "transparent" } },
    { stageId: "b", name: "B", value: 100, incomingConversion: 10, incomingDropOff: 90, itemStyle: { color: "transparent" } },
    { stageId: "c", name: "C", value: 10, incomingConversion: 10, incomingDropOff: 90, itemStyle: { color: "transparent" } },
  ];
  // Bars centered at x=100, stacked vertically, widths ∝ value.
  const rects = [
    { x: 0, y: 0, width: 200, height: 40 },
    { x: 90, y: 40, width: 20, height: 40 },
    { x: 99, y: 80, width: 2, height: 40 },
  ];
  const layout = createOutsideLabelLayout(data, { leaderLength: 24, minGap: 20 });

  it("anchors labels just right of their own bar edge with a long leader", () => {
    const r1 = layout({ dataIndex: 0, rect: rects[0] })!;
    const r2 = layout({ dataIndex: 1, rect: rects[1] })!;
    const r3 = layout({ dataIndex: 2, rect: rects[2] })!;
    // x = own bar right edge + leaderLength (24).
    expect(r1.x).toBe(224); // 200 + 24
    expect(r2.x).toBe(134); // 110 + 24
    expect(r3.x).toBe(125); // 101 + 24
  });

  it("cascades labels downward only when they would overlap", () => {
    const fresh = createOutsideLabelLayout(data, { leaderLength: 24, minGap: 20 });
    const r1 = fresh({ dataIndex: 0, rect: rects[0] })!;
    const r2 = fresh({ dataIndex: 1, rect: rects[1] })!;
    const r3 = fresh({ dataIndex: 2, rect: rects[2] })!;
    expect(r1.y).toBe(20); // own bar center
    expect(r2.y).toBe(60); // bands 40px apart, 20px labels → no push needed
    expect(r3.y).toBe(100);
    // With tighter bands the cascade guarantees the min gap:
    const tight = createOutsideLabelLayout(data, { leaderLength: 24, minGap: 20 });
    const t1 = tight({ dataIndex: 0, rect: { x: 0, y: 0, width: 200, height: 12 } })!;
    const t2 = tight({ dataIndex: 1, rect: { x: 90, y: 12, width: 20, height: 12 } })!;
    const t3 = tight({ dataIndex: 2, rect: { x: 99, y: 24, width: 2, height: 12 } })!;
    expect((t2.y as number) - (t1.y as number)).toBeGreaterThanOrEqual(20);
    expect((t3.y as number) - (t2.y as number)).toBeGreaterThanOrEqual(20);
  });

  it("emits a straight leader when level with the bar, bent when cascaded", () => {
    const fresh = createOutsideLabelLayout(data, { leaderLength: 24, minGap: 20 });
    const r2 = fresh({ dataIndex: 1, rect: rects[1] })!; // level → straight
    expect((r2.labelLinePoints as number[][]).length).toBe(2);
    const tight = createOutsideLabelLayout(data, { leaderLength: 24, minGap: 20 });
    tight({ dataIndex: 0, rect: { x: 0, y: 0, width: 200, height: 12 } });
    const t2 = tight({ dataIndex: 1, rect: { x: 90, y: 12, width: 20, height: 12 } })!;
    expect((t2.labelLinePoints as number[][]).length).toBe(3); // cascaded → bent
  });

  it("resets the cascade on each new layout pass", () => {
    const fresh = createOutsideLabelLayout(data, { leaderLength: 24, minGap: 20 });
    const firstPass = [0, 1, 2].map((i) => fresh({ dataIndex: i, rect: rects[i] })!);
    // Second pass (ECharts re-layouts on animation/resize): same results.
    const secondPass = [0, 1, 2].map((i) => fresh({ dataIndex: i, rect: rects[i] })!);
    expect(secondPass.map((r) => r.y)).toEqual(firstPass.map((r) => r.y));
    expect(secondPass.map((r) => r.x)).toEqual(firstPass.map((r) => r.x));
  });

  it("leaves hidden/empty labels untouched", () => {
    const empty = { stageId: "z", name: "Z", value: 5, incomingConversion: null, incomingDropOff: null, itemStyle: { color: "transparent" } };
    const layout2 = createOutsideLabelLayout([empty], { leaderLength: 24, minGap: 20 });
    expect(layout2({ dataIndex: 0, rect: rects[0] })).toBeUndefined();
  });
});

describe("chartTheme palette (D2)", () => {
  it("stage colors follow the default palette", () => {
    expect(stageColor(0)).toBe("#3B82F6");
    expect(stageColor(2)).toBe("#14B8A6");
    expect(stageColor(4)).toBe("#F59E0B");
  });

  it("transition color = destination stage color", () => {
    expect(transitionColor(1)).toBe(stageColor(1));
    expect(transitionColor(4)).toBe("#F59E0B");
  });

  it("repeats palette beyond 5 stages", () => {
    expect(stageColor(5)).toBe(stageColor(0));
  });

  it("theme override wins", () => {
    expect(stageColor(0, { stageColors: ["#123456"] })).toBe("#123456");
  });
});
