import type {
  FunnelAnalysisData,
  FunnelAnalysisViewModel,
  FunnelStageObservation,
  FunnelStageViewModel,
  FunnelTransitionViewModel,
} from "../types/funnelAnalysis.types";

/**
 * Metric engine — pure functions. All rates are derived from stage counts.
 * Zero denominators and missing data yield `null` (unavailable), never
 * NaN, Infinity, or a silent 0%.
 */

/** N(i) / N(0) × 100. null when initial count is 0 or missing. */
export function calculateCumulativeConversion(
  count: number | undefined,
  initialCount: number | undefined,
): number | null {
  if (count === undefined || initialCount === undefined || initialCount === 0) {
    return null;
  }
  return (count / initialCount) * 100;
}

/** N(i) / N(i-1) × 100. null when denominator is 0 or either value is missing. */
export function calculateStageConversion(
  next: number | undefined,
  previous: number | undefined,
): number | null {
  if (next === undefined || previous === undefined || previous === 0) {
    return null;
  }
  return (next / previous) * 100;
}

/** 100 − stage-to-stage conversion. null when conversion is null. */
export function calculateDropOff(
  next: number | undefined,
  previous: number | undefined,
): number | null {
  const conversion = calculateStageConversion(next, previous);
  return conversion === null ? null : 100 - conversion;
}

/** Final stage / initial stage × 100. null when initial is 0 or missing. */
export function calculateOverallConversion(
  finalCount: number | undefined,
  initialCount: number | undefined,
): number | null {
  return calculateCumulativeConversion(finalCount, initialCount);
}

/** Build stage view models for one period's observations, in stage order. */
export function computeStageViewModels(
  stages: { id: string; label: string; order: number }[],
  observations: FunnelStageObservation[],
): FunnelStageViewModel[] {
  const countByStageId = new Map<string, number>();
  for (const obs of observations) {
    if (!countByStageId.has(obs.stageId)) {
      countByStageId.set(obs.stageId, obs.count);
    }
  }

  const sorted = [...stages].sort((a, b) => a.order - b.order);
  const initialCount = countByStageId.get(sorted[0]?.id ?? "");

  let previousCount: number | undefined;

  return sorted.map((stage) => {
    const count = countByStageId.get(stage.id);
    const cumulative = calculateCumulativeConversion(count, initialCount);
    const stageToStage = calculateStageConversion(count, previousCount);
    const dropOff =
      stageToStage === null ? null : 100 - stageToStage;
    previousCount = count;
    return {
      stage,
      count: count ?? 0,
      cumulativeConversion: cumulative,
      stageToStageConversion: stageToStage,
      dropOff,
    };
  });
}

/** Transitions are derived (D1): adjacent stage pairs, in stage order. */
export function computeTransitions(
  stageViewModels: FunnelStageViewModel[],
): FunnelTransitionViewModel[] {
  const transitions: FunnelTransitionViewModel[] = [];
  for (let i = 1; i < stageViewModels.length; i++) {
    const from = stageViewModels[i - 1]!;
    const to = stageViewModels[i]!;
    transitions.push({
      id: `${from.stage.id}->${to.stage.id}`,
      fromStageId: from.stage.id,
      toStageId: to.stage.id,
      conversionRate: to.stageToStageConversion,
      dropOffRate: to.dropOff,
    });
  }
  return transitions;
}

/**
 * Build the full view model for one period (or for a set of already-aggregated
 * observations). `observations` must belong to a single analysis context.
 */
export function buildFunnelViewModel(
  data: FunnelAnalysisData,
  observations: FunnelStageObservation[],
): FunnelAnalysisViewModel {
  const stageViewModels = computeStageViewModels(data.stages, observations);
  const transitions = computeTransitions(stageViewModels);
  const first = stageViewModels[0];
  const last = stageViewModels[stageViewModels.length - 1];
  const overall =
    first && last
      ? calculateOverallConversion(last.count, first.count)
      : null;
  return {
    overallConversion: overall,
    stages: stageViewModels,
    transitions,
    trend: [],
  };
}

/** Highest drop-off transition (for insights). null when no rate available. */
export function findHighestDropOff(
  transitions: FunnelTransitionViewModel[],
): FunnelTransitionViewModel | null {
  let worst: FunnelTransitionViewModel | null = null;
  for (const t of transitions) {
    if (t.dropOffRate === null) continue;
    if (worst === null || (worst.dropOffRate ?? -1) < t.dropOffRate) {
      worst = t;
    }
  }
  return worst;
}
