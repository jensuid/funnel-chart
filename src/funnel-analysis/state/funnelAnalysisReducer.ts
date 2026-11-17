import type {
  DateRange,
  FunnelAnalysisState,
  Granularity,
} from "../types/funnelAnalysis.types";
import type { FunnelAnalysisFilters } from "../types/api.types";

/**
 * Shared interaction state reducer — single source of truth for cross-panel
 * coordination. Pure, data-agnostic, fully unit-testable.
 *
 * Precedence rules (spec §6 Event API):
 * - Explicit selection beats hover; hover never mutates selection.
 * - Stage selection and transition selection are mutually exclusive
 *   (their highlight targets would conflict).
 * - Legend visibility never changes selection.
 * - Filter changes invalidate selections that no longer exist in the data.
 * - Reset restores defaults for filters, selections AND visibility.
 */

export type FunnelAnalysisAction =
  | { type: "selectStage"; stageId: string | null }
  | { type: "selectTransition"; transitionId: string | null }
  | { type: "hoverStage"; stageId: string | null }
  | { type: "hoverTransition"; transitionId: string | null }
  | { type: "setSeriesVisibility"; seriesIds: string[] }
  | {
      type: "setFilters";
      filters: FunnelAnalysisFilters;
      /** Current valid IDs — selections outside them are invalidated. */
      validStageIds?: string[];
      validTransitionIds?: string[];
    }
  | {
      type: "reset";
      /** Full series list + config defaults — reset restores ALL series visible. */
      allSeriesIds: string[];
      defaults?: StateDefaults;
    };

export interface StateDefaults {
  dateRange?: DateRange | null;
  segment?: string | null;
  granularity?: Granularity;
}

export function createInitialState(
  allSeriesIds: string[],
  defaults: StateDefaults = {},
): FunnelAnalysisState {
  return {
    dateRange: defaults.dateRange ?? null,
    segment: defaults.segment ?? null,
    granularity: defaults.granularity ?? "daily",
    selectedStageId: null,
    selectedTransitionId: null,
    visibleSeriesIds: [...allSeriesIds],
    hoveredStageId: null,
    hoveredTransitionId: null,
  };
}

export function funnelAnalysisReducer(
  state: FunnelAnalysisState,
  action: FunnelAnalysisAction,
): FunnelAnalysisState {
  switch (action.type) {
    case "selectStage": {
      // Mutual exclusivity: a stage selection replaces any transition selection.
      return {
        ...state,
        selectedStageId: action.stageId,
        selectedTransitionId: null,
      };
    }
    case "selectTransition": {
      return {
        ...state,
        selectedTransitionId: action.transitionId,
        selectedStageId: null,
      };
    }
    case "hoverStage":
      // Hover never touches selection.
      return { ...state, hoveredStageId: action.stageId };
    case "hoverTransition":
      return { ...state, hoveredTransitionId: action.transitionId };
    case "setSeriesVisibility":
      // Visibility never touches selection.
      return { ...state, visibleSeriesIds: [...action.seriesIds] };
    case "setFilters": {
      const next = {
        ...state,
        dateRange: action.filters.dateRange ?? state.dateRange,
        segment: action.filters.segment !== undefined ? action.filters.segment : state.segment,
        granularity: action.filters.granularity ?? state.granularity,
      };
      // Invalidate selections that no longer exist after recalculation.
      if (action.validStageIds) {
        if (next.selectedStageId && !action.validStageIds.includes(next.selectedStageId)) {
          next.selectedStageId = null;
        }
        if (next.hoveredStageId && !action.validStageIds.includes(next.hoveredStageId)) {
          next.hoveredStageId = null;
        }
      }
      if (action.validTransitionIds) {
        if (
          next.selectedTransitionId &&
          !action.validTransitionIds.includes(next.selectedTransitionId)
        ) {
          next.selectedTransitionId = null;
        }
        if (
          next.hoveredTransitionId &&
          !action.validTransitionIds.includes(next.hoveredTransitionId)
        ) {
          next.hoveredTransitionId = null;
        }
        // Visibility: keep only valid series (order follows validTransitionIds).
        next.visibleSeriesIds = action.validTransitionIds.filter((id) =>
          next.visibleSeriesIds.includes(id),
        );
      }
      return next;
    }
    case "reset":
      // Reset restores default filters, selections AND visibility (all series).
      return createInitialState(action.allSeriesIds, action.defaults);
    default: {
      const exhaustive: never = action;
      void exhaustive;
      return state;
    }
  }
}
