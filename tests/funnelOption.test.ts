import { describe, it, expect } from "vitest";
import { createFunnelOption } from "../src/funnel-analysis/charts/createFunnelOption";
import { buildTransitionLabelSeries } from "../src/funnel-analysis/charts/dropOffIndicators";
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
