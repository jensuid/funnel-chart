import type {
  FunnelValidationResult,
  NonMonotonicPolicy,
  ValidationIssue,
  ValidationSeverity,
} from "../types/api.types";
import type { FunnelAnalysisData } from "../types/funnelAnalysis.types";

/**
 * Data validation. Order: structural → referential → numerical → analytical.
 * Structural and numerical issues are ALWAYS strict (error → dataset rejected).
 * NON_MONOTONIC_FUNNEL follows the configured policy (default: warning).
 */

export interface ValidateOptions {
  nonMonotonicPolicy?: NonMonotonicPolicy;
}

function issue(
  code: ValidationIssue["code"],
  severity: ValidationSeverity,
  message: string,
  extra?: { stageId?: string; period?: string },
): ValidationIssue {
  return { code, severity, message, ...extra };
}

export function validateFunnelData(
  data: FunnelAnalysisData,
  options: ValidateOptions = {},
): FunnelValidationResult {
  const issues: ValidationIssue[] = [];
  const policy: NonMonotonicPolicy = options.nonMonotonicPolicy ?? "warning";

  // --- structural ---
  if (!Array.isArray(data.stages) || data.stages.length === 0) {
    issues.push(issue("MISSING_STAGE", "error", "Dataset has no stage definitions."));
  }
  const seenIds = new Set<string>();
  const seenOrders = new Set<number>();
  for (const stage of data.stages ?? []) {
    if (!stage.id) {
      issues.push(issue("MISSING_STAGE", "error", "A stage definition is missing its id."));
      continue;
    }
    if (seenIds.has(stage.id)) {
      issues.push(
        issue("DUPLICATE_STAGE_ID", "error", `Duplicate stage id "${stage.id}".`, {
          stageId: stage.id,
        }),
      );
    }
    seenIds.add(stage.id);
    if (!Number.isInteger(stage.order) || stage.order < 1) {
      issues.push(
        issue(
          "INVALID_STAGE_ORDER",
          "error",
          `Stage "${stage.id}" has invalid order ${String(stage.order)} (must be a positive integer).`,
          { stageId: stage.id },
        ),
      );
    } else if (seenOrders.has(stage.order)) {
      issues.push(
        issue(
          "INVALID_STAGE_ORDER",
          "error",
          `Stages ${stage.id} share duplicate order ${String(stage.order)}.`,
          { stageId: stage.id },
        ),
      );
    }
    seenOrders.add(stage.order);
  }

  const validIds = seenIds;
  if (validIds.size === 0) {
    return { valid: false, issues };
  }

  // --- referential + numerical (per period) ---
  const periods = Array.isArray(data.periods) ? data.periods : [];
  for (const period of periods) {
    if (!Array.isArray(period.stages)) continue;
    const countsByStage = new Map<string, number>();
    for (const obs of period.stages) {
      if (!validIds.has(obs.stageId)) {
        issues.push(
          issue(
            "UNKNOWN_STAGE_REFERENCE",
            "error",
            `Period "${period.period}" references unknown stage "${obs.stageId}".`,
            { stageId: obs.stageId, period: period.period },
          ),
        );
        continue;
      }
      if (typeof obs.count !== "number" || !Number.isFinite(obs.count)) {
        issues.push(
          issue(
            "NEGATIVE_COUNT",
            "error",
            `Period "${period.period}" stage "${obs.stageId}" has non-finite count.`,
            { stageId: obs.stageId, period: period.period },
          ),
        );
        continue;
      }
      if (obs.count < 0) {
        issues.push(
          issue(
            "NEGATIVE_COUNT",
            "error",
            `Period "${period.period}" stage "${obs.stageId}" has negative count ${String(obs.count)}.`,
            { stageId: obs.stageId, period: period.period },
          ),
        );
        continue;
      }
      if (!countsByStage.has(obs.stageId)) {
        countsByStage.set(obs.stageId, obs.count);
      }
    }

    // --- analytical: monotonicity within this period (stage order) ---
    const orderedStages = [...data.stages].sort((a, b) => a.order - b.order);
    let prev: { id: string; count: number } | undefined;
    for (const stage of orderedStages) {
      const count = countsByStage.get(stage.id);
      if (count === undefined) {
        issues.push(
          issue(
            "MISSING_PERIOD_DATA",
            "warning",
            `Period "${period.period}" is missing an observation for stage "${stage.id}".`,
            { stageId: stage.id, period: period.period },
          ),
        );
        continue;
      }
      if (prev && count > prev.count) {
        const severity = policy === "strict" ? "error" : policy === "warning" ? "warning" : "info";
        issues.push(
          issue(
            "NON_MONOTONIC_FUNNEL",
            severity,
            `Period "${period.period}": stage "${stage.id}" (${String(count)}) exceeds previous stage "${prev.id}" (${String(prev.count)}).`,
            { stageId: stage.id, period: period.period },
          ),
        );
      }
      prev = { id: stage.id, count };
    }

    // --- analytical: zero denominators (info, not an error) ---
    // A zero-count stage is the denominator of the NEXT transition.
    for (let i = 0; i < orderedStages.length; i++) {
      const stage = orderedStages[i]!;
      if (i === orderedStages.length - 1) break;
      if (countsByStage.get(stage.id) === 0) {
        issues.push(
          issue(
            "ZERO_DENOMINATOR",
            "info",
            `Period "${period.period}": stage "${stage.id}" has zero count; rates from this stage become unavailable.`,
            { stageId: stage.id, period: period.period },
          ),
        );
      }
    }
  }

  if (periods.length === 0) {
    issues.push(
      issue("MISSING_PERIOD_DATA", "warning", "Dataset has no period observations."),
    );
  }

  return { valid: !issues.some((i) => i.severity === "error"), issues };
}
