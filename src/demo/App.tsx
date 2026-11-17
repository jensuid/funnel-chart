import { useMemo } from "react";
import { FunnelAnalysis } from "../funnel-analysis/components/FunnelAnalysis";
import type { FunnelAnalysisData } from "../funnel-analysis/types/funnelAnalysis.types";
import {
  standardFunnelFixture,
  highDropoffFixture,
  zeroVolumeFixture,
  nonMonotonicFixture,
  incompleteFixture,
  largeFixture,
} from "../../tests/fixtures";

/**
 * Demo host for visual regression + manual QA.
 *
 * Query params (see e2e/visual-regression.spec.ts):
 *   fixture=standard|highDropoff|zero|nonMonotonic|incomplete|large|invalid
 *   select=<stageId | transitionId>     e.g. cart | visitors->views
 *   legend=off:<transitionId>           e.g. cart->checkout
 *   from=<date>&to=<date>               date-range filter
 *   theme=dark                          dark mode
 *   layout=compact|stacked              layout variant
 */

const FIXTURES: Record<string, FunnelAnalysisData> = {
  standard: standardFunnelFixture,
  highDropoff: highDropoffFixture,
  zero: zeroVolumeFixture,
  nonMonotonic: nonMonotonicFixture,
  incomplete: incompleteFixture,
  large: largeFixture,
};

const invalidFixture: FunnelAnalysisData = {
  ...standardFunnelFixture,
  periods: [
    { period: "2026-W01", stages: [{ stageId: "visitors", count: -3 }] },
  ],
};

function parseParams(): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(window.location.search));
}

export function App() {
  const params = useMemo(parseParams, []);
  const fixtureName = params.fixture ?? "standard";
  const data = fixtureName === "invalid" ? invalidFixture : FIXTURES[fixtureName] ?? standardFunnelFixture;

  const selection = useMemo(() => {
    const sel: {
      selectedStageId?: string | null;
      selectedTransitionId?: string | null;
      visibleSeriesIds?: string[];
    } = {};
    if (params.select) {
      if (params.select.includes("->")) sel.selectedTransitionId = params.select;
      else sel.selectedStageId = params.select;
    }
    if (params.legend?.startsWith("off:")) {
      const hidden = params.legend.slice("off:".length);
      sel.visibleSeriesIds = (data.stages ?? [])
        .slice(0, -1)
        .map((s, i, arr) => (i < arr.length - 1 ? `${s.id}->${arr[i + 1]!.id}` : ""))
        .filter((id) => id && id !== hidden);
    }
    return sel;
  }, [params, data]);

  return (
    <main style={{ padding: 24, background: params.theme === "dark" ? "#111827" : "#F9FAFB", minHeight: "100vh" }}>
      <FunnelAnalysis
        data={data}
        selection={selection}
        filters={{
          dateRange: params.from || params.to
            ? { from: params.from ?? "", to: params.to ?? "" }
            : undefined,
          granularity: "weekly",
        }}
        config={{
          theme: params.theme === "dark" ? { mode: "dark" } : undefined,
          layout: (params.layout as "default" | "compact" | "stacked") ?? undefined,
          showDataTable: true,
        }}
        onStageSelect={(id) => console.log("stage.select", id)}
        onTransitionSelect={(id) => console.log("transition.select", id)}
        onSeriesVisibilityChange={(ids) => console.log("series.visibility", ids)}
      />
    </main>
  );
}
