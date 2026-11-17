import { useCallback, useMemo, useReducer } from "react";
import type {
  FunnelStage,
  FunnelStageViewModel,
  FunnelTransitionViewModel,
} from "../types/funnelAnalysis.types";
import type {
  FunnelAnalysisConfig,
  FunnelAnalysisEvent,
  FunnelAnalysisFilters,
  FunnelAnalysisSelection,
} from "../types/api.types";
import {
  createInitialState,
  funnelAnalysisReducer,
  type StateDefaults,
} from "./funnelAnalysisReducer";

/**
 * Interaction coordinator — pure helpers + React hook.
 *
 * React owns the shared state; ECharts events are forwarded here and translated
 * into application actions. The chart never becomes the source of truth.
 */

// ---------------------------------------------------------------------------
// Pure helpers (unit-testable without React)
// ---------------------------------------------------------------------------

/** Incoming + outgoing transition IDs of a stage (spec Scenario A). */
export function adjacentTransitionIds(
  stageId: string,
  transitions: FunnelTransitionViewModel[],
): string[] {
  return transitions
    .filter(
      (t) => t.fromStageId === stageId || t.toStageId === stageId,
    )
    .map((t) => t.id);
}

/** Funnel emphasis: selected stage, or both stages of the selected transition. */
export function focusStageIds(
  state: { selectedStageId: string | null; selectedTransitionId: string | null },
  transitions: FunnelTransitionViewModel[],
): string[] {
  if (state.selectedStageId) return [state.selectedStageId];
  if (state.selectedTransitionId) {
    const t = transitions.find((x) => x.id === state.selectedTransitionId);
    if (t) return [t.fromStageId, t.toStageId];
  }
  return [];
}

/** Trend emphasis: selected transition, or in/out transitions of the selected stage. */
export function focusTransitionIds(
  state: { selectedStageId: string | null; selectedTransitionId: string | null },
  transitions: FunnelTransitionViewModel[],
): string[] {
  if (state.selectedTransitionId) return [state.selectedTransitionId];
  if (state.selectedStageId) {
    return adjacentTransitionIds(state.selectedStageId, transitions);
  }
  return [];
}

/** ECharts legendselectchanged (keyed by series NAME) → visible series IDs. */
export function legendSelectionToVisibility(
  selectedByName: Record<string, boolean>,
  transitions: FunnelTransitionViewModel[],
  stages: FunnelStage[],
): string[] {
  return transitions
    .filter((t) => {
      const name = seriesNameOf(t, stages);
      return selectedByName[name] !== false;
    })
    .map((t) => t.id);
}

function seriesNameOf(
  t: FunnelTransitionViewModel,
  stages: FunnelStage[],
): string {
  const label = (id: string) => stages.find((s) => s.id === id)?.label ?? id;
  return `${label(t.fromStageId)} → ${label(t.toStageId)}`;
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseFunnelInteractionArgs {
  stages: FunnelStage[];
  transitions: FunnelTransitionViewModel[];
  config?: FunnelAnalysisConfig;
  /** Controlled filters — parent owns state when provided. */
  filters?: FunnelAnalysisFilters;
  /** Controlled selection — parent owns state when provided. */
  selection?: FunnelAnalysisSelection;
  onFilterChange?: (filters: FunnelAnalysisFilters) => void;
  onStageSelect?: (stage: FunnelStage | null) => void;
  onTransitionSelect?: (transition: FunnelTransitionViewModel | null) => void;
  onSeriesVisibilityChange?: (seriesIds: string[]) => void;
  onEvent?: (event: FunnelAnalysisEvent) => void;
  onReset?: () => void;
}

export interface FunnelChartEventParams {
  componentType?: string;
  seriesId?: string;
  seriesName?: string;
  data?: unknown;
  selected?: Record<string, boolean>;
}

export interface FunnelInteractionApi {
  state: {
    dateRange: DateRangeLike | null;
    segment: string | null;
    granularity: string;
    selectedStageId: string | null;
    selectedTransitionId: string | null;
    visibleSeriesIds: string[];
    hoveredStageId: string | null;
    hoveredTransitionId: string | null;
  };
  selectStage: (stageId: string | null) => void;
  selectTransition: (transitionId: string | null) => void;
  hoverStage: (stageId: string | null) => void;
  hoverTransition: (transitionId: string | null) => void;
  setSeriesVisibility: (seriesIds: string[]) => void;
  setFilters: (filters: FunnelAnalysisFilters) => void;
  reset: () => void;
  /** Handlers to spread onto EChartsWrapper onEvents. */
  chartHandlers: {
    click: (params: unknown) => void;
    mouseover: (params: unknown) => void;
    mouseout: (params: unknown) => void;
    legendselectchanged: (params: unknown) => void;
  };
}

type DateRangeLike = { from: string; to: string };

export function useFunnelInteraction(
  args: UseFunnelInteractionArgs,
): FunnelInteractionApi {
  const {
    stages,
    transitions,
    config,
    filters,
    selection,
    onFilterChange,
    onStageSelect,
    onTransitionSelect,
    onSeriesVisibilityChange,
    onEvent,
    onReset,
  } = args;

  const allSeriesIds = useMemo(() => transitions.map((t) => t.id), [transitions]);
  const defaults: StateDefaults = useMemo(
    () => ({
      dateRange: config?.defaultDateRange ?? null,
      segment: null,
      granularity: config?.defaultGranularity ?? "daily",
    }),
    [config?.defaultDateRange, config?.defaultGranularity],
  );

  const [internal, dispatch] = useReducer(
    (state: ReturnType<typeof createInitialState>, action: Parameters<typeof funnelAnalysisReducer>[1]) =>
      funnelAnalysisReducer(state, action),
    allSeriesIds,
    (ids) => createInitialState(ids, defaults),
  );

  // Controlled props override internal state when provided (single truth: parent).
  const state = useMemo(
    () => ({
      ...internal,
      ...(filters !== undefined
        ? {
            dateRange: filters.dateRange ?? internal.dateRange,
            segment: filters.segment !== undefined ? filters.segment : internal.segment,
            granularity: filters.granularity ?? internal.granularity,
          }
        : {}),
      ...(selection !== undefined
        ? {
            selectedStageId:
              selection.selectedStageId !== undefined
                ? selection.selectedStageId
                : internal.selectedStageId,
            selectedTransitionId:
              selection.selectedTransitionId !== undefined
                ? selection.selectedTransitionId
                : internal.selectedTransitionId,
            visibleSeriesIds:
              selection.visibleSeriesIds !== undefined
                ? selection.visibleSeriesIds
                : internal.visibleSeriesIds,
          }
        : {}),
    }),
    [internal, filters, selection],
  );

  const emit = useCallback(
    (event: FunnelAnalysisEvent) => {
      onEvent?.(event);
      switch (event.type) {
        case "stage.select": {
          const stage = event.stageId
            ? stages.find((s) => s.id === event.stageId) ?? null
            : null;
          onStageSelect?.(stage);
          break;
        }
        case "transition.select": {
          const transition = event.transitionId
            ? transitions.find((t) => t.id === event.transitionId) ?? null
            : null;
          onTransitionSelect?.(transition);
          break;
        }
        case "series.visibility.change":
          onSeriesVisibilityChange?.(event.seriesIds);
          break;
        case "filter.change":
          onFilterChange?.(event.filters);
          break;
        case "selection.reset":
          onReset?.();
          break;
      }
    },
    [onEvent, onStageSelect, onTransitionSelect, onSeriesVisibilityChange, onFilterChange, onReset, stages, transitions],
  );

  const selectStage = useCallback(
    (stageId: string | null) => {
      dispatch({ type: "selectStage", stageId });
      emit({ type: "stage.select", stageId });
    },
    [emit],
  );

  const selectTransition = useCallback(
    (transitionId: string | null) => {
      dispatch({ type: "selectTransition", transitionId });
      emit({ type: "transition.select", transitionId });
    },
    [emit],
  );

  const hoverStage = useCallback((stageId: string | null) => {
    dispatch({ type: "hoverStage", stageId });
  }, []);

  const hoverTransition = useCallback((transitionId: string | null) => {
    dispatch({ type: "hoverTransition", transitionId });
  }, []);

  const setSeriesVisibility = useCallback(
    (seriesIds: string[]) => {
      dispatch({ type: "setSeriesVisibility", seriesIds });
      emit({ type: "series.visibility.change", seriesIds });
    },
    [emit],
  );

  const setFilters = useCallback(
    (next: FunnelAnalysisFilters) => {
      dispatch({
        type: "setFilters",
        filters: next,
        validStageIds: stages.map((s) => s.id),
        validTransitionIds: transitions.map((t) => t.id),
      });
      emit({ type: "filter.change", filters: next });
    },
    [emit, stages, transitions],
  );

  const reset = useCallback(() => {
    dispatch({ type: "reset", allSeriesIds, defaults });
    emit({ type: "selection.reset" });
  }, [allSeriesIds, defaults, emit]);

  // --- ECharts event translation ------------------------------------------

  const onClick = useCallback(
    (raw: unknown) => {
      const params = raw as FunnelChartEventParams;
      if (params.seriesId === "funnel-stages") {
        const datum = params.data as { id?: string } | undefined;
        const stageId = datum?.id ?? null;
        // Toggle: clicking the selected stage deselects it.
        selectStage(state.selectedStageId === stageId ? null : stageId);
        return;
      }
      const transition = transitions.find((t) => t.id === params.seriesId);
      if (transition) {
        selectTransition(
          state.selectedTransitionId === transition.id ? null : transition.id,
        );
      }
    },
    [selectStage, selectTransition, state.selectedStageId, state.selectedTransitionId, transitions],
  );

  const onMouseover = useCallback(
    (raw: unknown) => {
      const params = raw as FunnelChartEventParams;
      if (params.seriesId === "funnel-stages") {
        const datum = params.data as { id?: string } | undefined;
        if (datum?.id) hoverStage(datum.id);
        return;
      }
      if (params.seriesId && transitions.some((t) => t.id === params.seriesId)) {
        hoverTransition(params.seriesId);
      }
    },
    [hoverStage, hoverTransition, transitions],
  );

  const onMouseout = useCallback(() => {
    hoverStage(null);
    hoverTransition(null);
  }, [hoverStage, hoverTransition]);

  const onLegendChanged = useCallback(
    (raw: unknown) => {
      const params = raw as FunnelChartEventParams;
      if (!params.selected) return;
      setSeriesVisibility(
        legendSelectionToVisibility(params.selected, transitions, stages),
      );
    },
    [setSeriesVisibility, transitions, stages],
  );

  return {
    state,
    selectStage,
    selectTransition,
    hoverStage,
    hoverTransition,
    setSeriesVisibility,
    setFilters,
    reset,
    chartHandlers: {
      click: onClick,
      mouseover: onMouseover,
      mouseout: onMouseout,
      legendselectchanged: onLegendChanged,
    },
  };
}
