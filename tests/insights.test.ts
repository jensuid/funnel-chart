import { describe, it, expect } from "vitest";
import { generateInsights } from "../src/funnel-analysis/insights/generateInsights";
import { buildFunnelViewModel } from "../src/funnel-analysis/metrics/calculateFunnelMetrics";
import { buildTrend } from "../src/funnel-analysis/metrics/aggregateTrendMetrics";
import { computeTransitions } from "../src/funnel-analysis/metrics/calculateFunnelMetrics";
import { normalizeFunnelData } from "../src/funnel-analysis/adapters/normalizeFunnelData";
import {
  highDropoffFixture,
  standardFunnelFixture,
  zeroVolumeFixture,
} from "./fixtures";

const normalized = normalizeFunnelData(standardFunnelFixture);
const transitions = computeTransitions(
  normalized.stages.map((stage) => ({
    stage,
    count: 0,
    cumulativeConversion: null,
    stageToStageConversion: null,
    dropOff: null,
  })),
);

function buildInput(fixture = standardFunnelFixture) {
  const norm = normalizeFunnelData(fixture);
  const latest = norm.periods.at(-1)!;
  const vm = buildFunnelViewModel(norm, latest.stages);
  const { trend } = buildTrend(norm, transitions, "weekly");
  const periods = [...new Set(trend.map((p) => p.period))];
  return { stages: vm.stages, transitions: vm.transitions, trend, periods };
}

describe("generateInsights — highest drop-off", () => {
  it("detects the largest loss transition", () => {
    const insights = generateInsights(buildInput(highDropoffFixture));
    const worst = insights.find((i) => i.type === "highest_dropoff")!;
    expect(worst.transitionId).toBe("checkout->purchase");
    expect(worst.value).toBeCloseTo(95, 10);
    expect(worst.severity).toBe("warning"); // >= 50%
  });

  it("zero-volume funnel produces no highest-dropoff insight", () => {
    const insights = generateInsights(buildInput(zeroVolumeFixture));
    expect(insights.find((i) => i.type === "highest_dropoff")).toBeUndefined();
  });
});

describe("generateInsights — improving/declining (pp, not %)", () => {
  it("detects week-over-week pp changes on the golden dataset", () => {
    const insights = generateInsights(buildInput());
    // Week1→Week2: V→V 70→70 (0), V→C 50→57.14 (+7.14), C→Co 50→50 (0), Co→P 40→50 (+10)
    const improving = insights.filter((i) => i.type === "improving");
    expect(improving.map((i) => i.transitionId).sort()).toEqual([
      "checkout->purchase",
      "views->cart",
    ]);
    const v2c = improving.find((i) => i.transitionId === "views->cart")!;
    expect(v2c.change).toBeCloseTo(7.14, 2);
    expect(v2c.comparisonPeriod).toBe("2026-W01");
    expect(insights.find((i) => i.type === "declining")).toBeUndefined();
  });

  it("reports a decline with positive-severity wording intact", () => {
    const input = buildInput();
    // Flip week 2 so checkout->purchase declines 40 → 30.
    const trend = input.trend.map((p) =>
      p.period === "2026-W02" && p.transitionId === "checkout->purchase"
        ? { ...p, conversionRate: 30 }
        : p,
    );
    const insights = generateInsights({ ...input, trend });
    const declining = insights.find((i) => i.type === "declining")!;
    expect(declining.transitionId).toBe("checkout->purchase");
    expect(declining.change).toBeCloseTo(-10, 10);
    expect(declining.severity).toBe("warning");
  });

  it("emits a single stable insight when all changes are below threshold", () => {
    const input = buildInput();
    // Make week 2 identical to week 1 for every transition.
    const trend = input.trend.map((p) =>
      p.period === "2026-W02"
        ? {
            ...p,
            conversionRate: input.trend.find(
              (q) =>
                q.period === "2026-W01" && q.transitionId === p.transitionId,
            )!.conversionRate,
          }
        : p,
    );
    const insights = generateInsights({ ...input, trend });
    const stable = insights.filter((i) => i.type === "stable");
    expect(stable.length).toBe(1);
    expect(insights.find((i) => i.type === "improving")).toBeUndefined();
    expect(insights.find((i) => i.type === "declining")).toBeUndefined();
  });

  it("respects custom thresholds", () => {
    const input = buildInput();
    const insights = generateInsights({
      ...input,
      config: { thresholds: { improvingPp: 20, decliningPp: -20 } },
    });
    // +7.14 and +10 pp are below a 20 pp threshold → no improving insights.
    expect(insights.find((i) => i.type === "improving")).toBeUndefined();
  });
});

describe("generateInsights — overall conversion", () => {
  it("reports overall with pp change vs previous bucket", () => {
    const insights = generateInsights(buildInput());
    const overall = insights.find((i) => i.type === "overall_conversion")!;
    expect(overall.value).toBeCloseTo(10, 10); // Week 2
    expect(overall.change).toBeCloseTo(3, 6); // 10 − 7
    expect(overall.comparisonPeriod).toBe("2026-W01");
  });

  it("zero volume → unavailable wording, no value", () => {
    const insights = generateInsights(buildInput(zeroVolumeFixture));
    const overall = insights.find((i) => i.type === "overall_conversion")!;
    expect(overall.value).toBeUndefined();
    expect(overall.description).toContain("unavailable");
  });
});

describe("generateInsights — anomaly detection", () => {
  it("flags a >2σ deviation from the transition's own history", () => {
    const input = buildInput();
    // Extend with 4 more weeks: 3 stable at 70%, then a sudden 20%.
    // With population σ, 4 stable + 1 outlier over 5 buckets yields exactly
    // 2.0σ; 5 stable + 1 outlier over 6 buckets yields √5 ≈ 2.24σ > 2.
    const extraPeriods = ["2026-W03", "2026-W04", "2026-W05", "2026-W06"];
    const trend = [
      ...input.trend,
      ...extraPeriods.flatMap((period) =>
        input.transitions.map((t) => ({
          period,
          transitionId: t.id,
          conversionRate:
            t.id === "visitors->views" ? (period === "2026-W06" ? 20 : 70) : 50,
        })),
      ),
    ];
    const insights = generateInsights({ ...input, trend, periods: [...input.periods, ...extraPeriods] });
    const anomaly = insights.find((i) => i.type === "anomaly");
    expect(anomaly).toBeDefined();
    expect(anomaly?.transitionId).toBe("visitors->views");
    expect(anomaly?.severity).toBe("critical");
  });

  it("skips anomaly detection with fewer than 3 buckets", () => {
    const insights = generateInsights(buildInput());
    expect(insights.find((i) => i.type === "anomaly")).toBeUndefined();
  });
});
