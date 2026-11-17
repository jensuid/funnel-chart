import { describe, it, expect } from "vitest";
import {
  aggregatePeriods,
  aggregateTransitionRate,
  bucketKey,
  buildTrend,
  isoWeekLabel,
} from "../src/funnel-analysis/metrics/aggregateTrendMetrics";
import { computeTransitions } from "../src/funnel-analysis/metrics/calculateFunnelMetrics";
import { normalizeFunnelData } from "../src/funnel-analysis/adapters/normalizeFunnelData";
import {
  incompleteFixture,
  standardFunnelFixture,
} from "./fixtures";

describe("bucketKey", () => {
  it("daily → identity", () => {
    expect(bucketKey("2026-10-01", "daily")).toBe("2026-10-01");
  });

  it("dates map to ISO weeks", () => {
    expect(bucketKey("2026-10-05", "weekly")).toBe(isoWeekLabel(2026, 10, 5));
  });

  it("dates map to months", () => {
    expect(bucketKey("2026-10-17", "monthly")).toBe("2026-10");
  });

  it("week labels map to months via their Monday", () => {
    // 2026-W01 Monday must land in some YYYY-MM
    expect(bucketKey("2026-W01", "monthly")).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("aggregatePeriods — Σ-ratio, not average of rates", () => {
  // Daily-date periods within one month, so monthly bucketing merges them.
  const dailyPeriods = [
    {
      period: "2026-01-05",
      stages: [
        { stageId: "visitors", count: 1000 },
        { stageId: "views", count: 700 },
      ],
    },
    {
      period: "2026-01-12",
      stages: [
        { stageId: "visitors", count: 1200 },
        { stageId: "views", count: 840 },
      ],
    },
  ];

  it("sums counts per stage per bucket", () => {
    const stageIds = standardFunnelFixture.stages.map((s) => s.id);
    const buckets = aggregatePeriods(dailyPeriods, stageIds, "monthly");
    expect(buckets.length).toBe(1);
    const visitors = buckets[0]!.observations.find((o) => o.stageId === "visitors")!;
    expect(visitors.count).toBe(2200); // 1000 + 1200
  });

  it("aggregate conversion uses summed counts (2200→1540 = 70%)", () => {
    const stageIds = standardFunnelFixture.stages.map((s) => s.id);
    const buckets = aggregatePeriods(dailyPeriods, stageIds, "monthly");
    const views = buckets[0]!.observations.find((o) => o.stageId === "views")!.count;
    const visitors = buckets[0]!.observations.find((o) => o.stageId === "visitors")!.count;
    expect((views / visitors) * 100).toBeCloseTo(70, 10);
  });

  it("does NOT average per-period rates when volumes differ", () => {
    // Period A: 100/100 = 100%. Period B: 10/1000 = 1%.
    // Σ-ratio = 110/1100 = 10%, average-of-rates would be 50.5%.
    const data = [
      {
        period: "2026-01-12",
        stages: [
          { stageId: "visitors", count: 100 },
          { stageId: "views", count: 100 },
        ],
      },
      {
        period: "2026-01-19",
        stages: [
          { stageId: "visitors", count: 1000 },
          { stageId: "views", count: 10 },
        ],
      },
    ];
    const stageIds = standardFunnelFixture.stages.map((s) => s.id);
    const buckets = aggregatePeriods(data, stageIds, "monthly");
    expect(buckets.length).toBe(1);
    const views = buckets[0]!.observations.find((o) => o.stageId === "views")!.count;
    const visitors = buckets[0]!.observations.find((o) => o.stageId === "visitors")!.count;
    expect((views / visitors) * 100).toBeCloseTo(10, 10);
  });

  it("week labels stay atomic under weekly granularity", () => {
    const normalized = normalizeFunnelData(standardFunnelFixture);
    const stageIds = normalized.stages.map((s) => s.id);
    const buckets = aggregatePeriods(normalized.periods, stageIds, "weekly");
    expect(buckets.map((b) => b.bucket)).toEqual(["2026-W01", "2026-W02"]);
  });

  it("ISO week labels crossing a year boundary map to correct months", () => {
    // 2026-W01 Monday = 2025-12-29 → '2025-12'; 2026-W02 Monday = 2026-01-05 → '2026-01'
    const normalized = normalizeFunnelData(standardFunnelFixture);
    const stageIds = normalized.stages.map((s) => s.id);
    const buckets = aggregatePeriods(normalized.periods, stageIds, "monthly");
    expect(buckets.map((b) => b.bucket)).toEqual(["2025-12", "2026-01"]);
    expect(buckets[0]!.observations.find((o) => o.stageId === "visitors")!.count).toBe(1000);
  });
});

describe("buildTrend", () => {
  const normalized = normalizeFunnelData(standardFunnelFixture);
  const stagesVm = normalized.stages;
  const transitions = computeTransitions(
    stagesVm.map((s) => ({
      stage: s,
      count: 0,
      cumulativeConversion: null,
      stageToStageConversion: null,
      dropOff: null,
    })),
  );

  it("produces one point per bucket per transition", () => {
    const { trend } = buildTrend(normalized, transitions, "daily");
    expect(trend.length).toBe(2 * transitions.length);
  });

  it("weekly granularity keeps week labels as buckets", () => {
    const { trend } = buildTrend(normalized, transitions, "weekly");
    const periods = [...new Set(trend.map((p) => p.period))];
    expect(periods).toEqual(["2026-W01", "2026-W02"]);
  });

  it("preserves gaps as null (incomplete fixture)", () => {
    const inc = normalizeFunnelData(incompleteFixture);
    const { trend, missingPeriods } = buildTrend(inc, transitions, "weekly");
    const w02 = trend.filter((p) => p.period.startsWith("2026-W02"));
    // visitors->views has data; deeper transitions are gaps
    expect(w02.find((p) => p.transitionId === "visitors->views")!.conversionRate).toBeCloseTo(70, 10);
    expect(w02.find((p) => p.transitionId === "cart->checkout")!.conversionRate).toBeNull();
    expect(missingPeriods).toContain("2026-W02");
  });

  it("zero denominator → null rate", () => {
    expect(
      aggregateTransitionRate(
        { total: 0, present: true },
        { total: 50, present: true },
      ),
    ).toBeNull();
    expect(
      aggregateTransitionRate(
        { total: undefined, present: false },
        { total: 50, present: true },
      ),
    ).toBeNull();
  });
});
