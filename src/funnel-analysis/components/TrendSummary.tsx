import type { FunnelAnalysisViewModel } from "../types/funnelAnalysis.types";

/**
 * Trend Summary panel — short data-derived text summary under the trend chart.
 * Every statement is computed from the view model; nothing hardcoded.
 */

export interface TrendSummaryProps {
  viewModel: FunnelAnalysisViewModel;
  periods: string[];
  granularity: string;
  missingPeriods: string[];
  loading?: boolean;
}

export function TrendSummary({
  viewModel,
  periods,
  granularity,
  missingPeriods,
  loading,
}: TrendSummaryProps) {
  if (loading) {
    return (
      <section className="fa-trend-summary" aria-busy="true" aria-label="Trend summary">
        <p className="fa-muted">Updating summary…</p>
      </section>
    );
  }

  const parts: string[] = [];

  const visibleTransitions = viewModel.transitions.filter((t) =>
    viewModel.trend.some((p) => p.transitionId === t.id && p.conversionRate !== null),
  );

  if (visibleTransitions.length > 0) {
    const best = visibleTransitions.reduce((a, b) =>
      (b.conversionRate ?? -1) > (a.conversionRate ?? -1) ? b : a,
    );
    parts.push(
      `Strongest transition: ${best.fromStageId} → ${best.toStageId} at ${(best.conversionRate ?? 0).toFixed(1)}%.`,
    );
    const worst = visibleTransitions.reduce((a, b) =>
      (b.dropOffRate ?? -1) > (a.dropOffRate ?? -1) ? b : a,
    );
    if (worst.dropOffRate !== null) {
      parts.push(
        `Weakest: ${worst.fromStageId} → ${worst.toStageId} losing ${(worst.dropOffRate ?? 0).toFixed(1)}%.`,
      );
    }
  } else {
    parts.push("No conversion rates available for the current filters.");
  }

  if (viewModel.overallConversion !== null) {
    parts.push(`Overall conversion: ${viewModel.overallConversion.toFixed(1)}%.`);
  }

  parts.push(
    `Trend covers ${periods.length} ${granularity} bucket${periods.length === 1 ? "" : "s"}.`,
  );

  if (missingPeriods.length > 0) {
    parts.push(
      `${missingPeriods.length} bucket${missingPeriods.length === 1 ? "" : "s"} have incomplete stage data (shown as gaps).`,
    );
  }

  return (
    <section className="fa-trend-summary" aria-label="Trend summary">
      <p>{parts.join(" ")}</p>
    </section>
  );
}
