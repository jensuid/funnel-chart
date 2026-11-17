import type {
  FunnelStageViewModel,
  FunnelTransitionViewModel,
  FunnelTrendPoint,
} from "../types/funnelAnalysis.types";
import type { FunnelInsight, InsightsConfig } from "../types/api.types";

/**
 * Rule-based insight engine — separated from chart rendering (spec §8).
 *
 * Rules:
 * - All insights derive from ACTUAL calculated metrics; nothing hardcoded.
 * - Changes are reported in percentage points (pp), never relative %.
 * - No statistical significance claims without tests — wording is descriptive.
 * - null rates (gaps/zero denominators) are skipped, never treated as 0.
 */

export interface GenerateInsightsInput {
  /** Latest-bucket stage view models (for overall conversion). */
  stages: FunnelStageViewModel[];
  /** Latest-bucket transitions (for highest drop-off). */
  transitions: FunnelTransitionViewModel[];
  /** Per-bucket trend points (for improving/declining/anomaly). */
  trend: FunnelTrendPoint[];
  /** Ordered bucket labels matching the trend. */
  periods: string[];
  config?: InsightsConfig;
}

export function generateInsights(input: GenerateInsightsInput): FunnelInsight[] {
  const {
    stages,
    transitions,
    trend,
    periods,
    config,
  } = input;

  const improvingPp = config?.thresholds?.improvingPp ?? 1.0;
  const decliningPp = config?.thresholds?.decliningPp ?? -1.0;
  const anomalySigma = config?.anomalySigma ?? 2;

  const insights: FunnelInsight[] = [];
  const latestPeriod = periods.at(-1) ?? null;
  const previousPeriod = periods.at(-2) ?? null;

  // --- 1. Highest drop-off (latest bucket) ---
  let worst: FunnelTransitionViewModel | null = null;
  for (const t of transitions) {
    if (t.dropOffRate === null) continue;
    if (worst === null || t.dropOffRate > (worst.dropOffRate ?? -1)) worst = t;
  }
  if (worst && worst.dropOffRate !== null) {
    insights.push({
      id: `highest-dropoff-${worst.id}`,
      type: "highest_dropoff",
      severity: worst.dropOffRate >= 50 ? "warning" : "neutral",
      title: "Highest drop-off",
      description: `${transitionLabel(worst)} loses ${worst.dropOffRate.toFixed(1)}% of its volume.`,
      transitionId: worst.id,
      value: worst.dropOffRate,
    });
  }

  // --- 2/3/4. Improving / declining / stable (latest vs previous bucket) ---
  if (latestPeriod && previousPeriod) {
    const changes: { transitionId: string; change: number }[] = [];
    for (const t of transitions) {
      const now = rateAt(trend, latestPeriod, t.id);
      const before = rateAt(trend, previousPeriod, t.id);
      if (now === null || before === null) continue; // gap — skip, not zero
      const change = now - before; // pp
      changes.push({ transitionId: t.id, change });

      if (change >= improvingPp) {
        insights.push({
          id: `improving-${t.id}`,
          type: "improving",
          severity: "positive",
          title: "Improving conversion",
          description: `${transitionLabel(t)} improved by ${change.toFixed(1)} pp compared with ${previousPeriod}.`,
          transitionId: t.id,
          value: now,
          change,
          comparisonPeriod: previousPeriod,
        });
      } else if (change <= decliningPp) {
        insights.push({
          id: `declining-${t.id}`,
          type: "declining",
          severity: "warning",
          title: "Declining conversion",
          description: `${transitionLabel(t)} declined by ${Math.abs(change).toFixed(1)} pp compared with ${previousPeriod}.`,
          transitionId: t.id,
          value: now,
          change,
          comparisonPeriod: previousPeriod,
        });
      }
    }
    if (changes.length > 0 && changes.every((c) => c.change > decliningPp && c.change < improvingPp)) {
      insights.push({
        id: "stable-transitions",
        type: "stable",
        severity: "neutral",
        title: "Stable conversions",
        description: `All ${changes.length} transitions changed by less than ${improvingPp.toFixed(1)} pp between ${previousPeriod} and ${latestPeriod}.`,
        comparisonPeriod: previousPeriod,
      });
    }
  }

  // --- 5. Overall conversion (latest bucket) ---
  const first = stages[0];
  const last = stages.at(-1);
  if (first && last) {
    const denominator = first.count;
    const overall =
      denominator === 0 ? null : (last.count / denominator) * 100;
    const prevOverall = previousPeriod
      ? overallAtPeriod(input, previousPeriod)
      : null;
    insights.push({
      id: "overall-conversion",
      type: "overall_conversion",
      severity: "neutral",
      title: "Overall conversion",
      description:
        overall === null
          ? "Overall conversion unavailable (zero initial volume)."
          : `${overall.toFixed(1)}% of initial volume reaches the final stage${
              prevOverall !== null
                ? ` (${formatPpChange(overall - prevOverall)} vs ${previousPeriod})`
                : ""
            }.`,
      value: overall ?? undefined,
      change:
        overall !== null && prevOverall !== null
          ? overall - prevOverall
          : undefined,
      comparisonPeriod: previousPeriod ?? undefined,
    });
  }

  // --- 6. Anomalies (deviation from the transition's own history) ---
  for (const t of transitions) {
    const rates = periods
      .map((p) => rateAt(trend, p, t.id))
      .filter((r): r is number => r !== null);
    if (rates.length < 3) continue; // not enough history for a meaningful sigma
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    const variance =
      rates.reduce((acc, r) => acc + (r - mean) ** 2, 0) / rates.length;
    const sigma = Math.sqrt(variance);
    if (sigma === 0) continue;
    const latest = rates.at(-1)!;
    const deviation = (latest - mean) / sigma;
    if (Math.abs(deviation) > anomalySigma) {
      insights.push({
        id: `anomaly-${t.id}`,
        type: "anomaly",
        severity: latest < mean ? "critical" : "positive",
        title: latest < mean ? "Anomalous drop" : "Anomalous spike",
        description: `${transitionLabel(t)} is at ${latest.toFixed(1)}%, ${Math.abs(deviation).toFixed(1)}σ ${latest < mean ? "below" : "above"} its average of ${mean.toFixed(1)}%.`,
        transitionId: t.id,
        value: latest,
        comparisonPeriod: latestPeriod ?? undefined,
      });
    }
  }

  return insights;
}

function transitionLabel(t: FunnelTransitionViewModel): string {
  return `${t.fromStageId} → ${t.toStageId}`;
}

function rateAt(
  trend: FunnelTrendPoint[],
  period: string,
  transitionId: string,
): number | null {
  return (
    trend.find((p) => p.period === period && p.transitionId === transitionId)
      ?.conversionRate ?? null
  );
}

/** Recompute overall conversion for an arbitrary bucket from the trend. */
function overallAtPeriod(
  input: GenerateInsightsInput,
  period: string,
): number | null {
  const firstStage = input.stages[0]?.stage.id;
  const lastStage = input.stages.at(-1)?.stage.id;
  if (!firstStage || !lastStage) return null;
  // Overall = product of stage-to-stage rates is NOT Σ-ratio-safe; instead
  // derive from the trend's first transition chain when available.
  // MVP: use the first transition's denominator basis via trend rates product.
  const rates = input.transitions
    .map((t) => rateAt(input.trend, period, t.id))
    .filter((r): r is number => r !== null);
  if (rates.length !== input.transitions.length) return null;
  return rates.reduce((acc, r) => acc * (r / 100), 1) * 100;
}

function formatPpChange(change: number): string {
  const rounded = change.toFixed(1);
  if (change >= 0) return `+${rounded} pp`;
  return `${rounded} pp`;
}
