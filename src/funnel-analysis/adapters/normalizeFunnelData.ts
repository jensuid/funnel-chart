import type { FunnelAnalysisData, FunnelStage } from "../types/funnelAnalysis.types";

/**
 * Data adapter: normalizes a validated dataset into a canonical shape for the
 * metric engine. Does NOT repair invalid data — run validateFunnelData first.
 */

/** Sort stages by order (stable), trim ids/labels. */
export function normalizeStages(stages: FunnelStage[]): FunnelStage[] {
  return stages
    .map((s) => ({ ...s, id: s.id.trim(), label: s.label.trim() }))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/**
 * Normalize periods: chronological sort (string sort works for the supported
 * ISO-ish formats), first observation wins per (period, stageId).
 */
export function normalizePeriods(
  periods: FunnelAnalysisData["periods"],
): FunnelAnalysisData["periods"] {
  return [...periods]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((period) => {
      const seen = new Set<string>();
      const stages = period.stages.filter((obs) => {
        if (seen.has(obs.stageId)) return false;
        seen.add(obs.stageId);
        return true;
      });
      return { ...period, stages };
    });
}

export function normalizeFunnelData(data: FunnelAnalysisData): FunnelAnalysisData {
  return {
    ...data,
    stages: normalizeStages(data.stages),
    periods: normalizePeriods(data.periods),
  };
}
