import type { FunnelAnalysisData } from "../../src/funnel-analysis/types/funnelAnalysis.types";

/** Golden test dataset — expected values in docs/DATA-CONTRACT.md §7. */
export const standardFunnelFixture: FunnelAnalysisData = {
  id: "test-funnel",
  name: "Test Funnel",
  stages: [
    { id: "visitors", label: "Visitors", order: 1 },
    { id: "views", label: "Views", order: 2 },
    { id: "cart", label: "Cart", order: 3 },
    { id: "checkout", label: "Checkout", order: 4 },
    { id: "purchase", label: "Purchase", order: 5 },
  ],
  periods: [
    {
      period: "2026-W01",
      stages: [
        { stageId: "visitors", count: 1000 },
        { stageId: "views", count: 700 },
        { stageId: "cart", count: 350 },
        { stageId: "checkout", count: 175 },
        { stageId: "purchase", count: 70 },
      ],
    },
    {
      period: "2026-W02",
      stages: [
        { stageId: "visitors", count: 1200 },
        { stageId: "views", count: 840 },
        { stageId: "cart", count: 480 },
        { stageId: "checkout", count: 240 },
        { stageId: "purchase", count: 120 },
      ],
    },
  ],
  metadata: { unit: "users", timezone: "Asia/Jakarta" },
};

/** Large loss concentrated at the final stage — insight detection. */
export const highDropoffFixture: FunnelAnalysisData = {
  id: "high-dropoff",
  name: "High Drop-off Funnel",
  stages: standardFunnelFixture.stages,
  periods: [
    {
      period: "2026-W01",
      stages: [
        { stageId: "visitors", count: 10000 },
        { stageId: "views", count: 8000 },
        { stageId: "cart", count: 6000 },
        { stageId: "checkout", count: 4000 },
        { stageId: "purchase", count: 200 },
      ],
    },
  ],
};

/** Zero users across the board — division-by-zero handling. */
export const zeroVolumeFixture: FunnelAnalysisData = {
  id: "zero-volume",
  name: "Zero Volume Funnel",
  stages: standardFunnelFixture.stages,
  periods: [
    {
      period: "2026-W01",
      stages: [
        { stageId: "visitors", count: 0 },
        { stageId: "views", count: 0 },
        { stageId: "cart", count: 0 },
        { stageId: "checkout", count: 0 },
        { stageId: "purchase", count: 0 },
      ],
    },
  ],
};

/** Later stage exceeds earlier stage — validation / non-monotonic policy. */
export const nonMonotonicFixture: FunnelAnalysisData = {
  id: "non-monotonic",
  name: "Non-monotonic Funnel",
  stages: standardFunnelFixture.stages,
  periods: [
    {
      period: "2026-W01",
      stages: [
        { stageId: "visitors", count: 1000 },
        { stageId: "views", count: 1200 },
        { stageId: "cart", count: 350 },
        { stageId: "checkout", count: 175 },
        { stageId: "purchase", count: 70 },
      ],
    },
  ],
};

/** Missing observations in some periods — partial-data handling. */
export const incompleteFixture: FunnelAnalysisData = {
  id: "incomplete",
  name: "Incomplete Funnel",
  stages: standardFunnelFixture.stages,
  periods: [
    {
      period: "2026-W01",
      stages: [
        { stageId: "visitors", count: 1000 },
        { stageId: "views", count: 700 },
        { stageId: "cart", count: 350 },
        { stageId: "checkout", count: 175 },
        { stageId: "purchase", count: 70 },
      ],
    },
    {
      period: "2026-W02",
      stages: [
        { stageId: "visitors", count: 1200 },
        { stageId: "views", count: 840 },
        // cart, checkout, purchase missing → gap, not zero
      ],
    },
  ],
};

/** Many stages and periods — performance. */
function buildLargeFixture(): FunnelAnalysisData {
  const stageCount = 12;
  const periodCount = 104;
  const stages = Array.from({ length: stageCount }, (_, i) => ({
    id: `stage-${i + 1}`,
    label: `Stage ${i + 1}`,
    order: i + 1,
  }));
  const periods = Array.from({ length: periodCount }, (_, p) => ({
    period: `2026-W${String((p % 52) + 1).padStart(2, "0")}-${String(Math.floor(p / 52) + 1)}`,
    stages: stages.map((s, i) => ({
      stageId: s.id,
      count: Math.max(0, Math.round(100000 / Math.pow(1.35, i)) + p),
    })),
  }));
  return { id: "large", name: "Large Funnel", stages, periods };
}

export const largeFixture: FunnelAnalysisData = buildLargeFixture();
