import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  createInitialState,
  funnelAnalysisReducer,
} from "../src/funnel-analysis/state/funnelAnalysisReducer";
import {
  adjacentTransitionIds,
  focusStageIds,
  focusTransitionIds,
  legendSelectionToVisibility,
  useFunnelInteraction,
} from "../src/funnel-analysis/state/interactionCoordinator";
import { computeTransitions } from "../src/funnel-analysis/metrics/calculateFunnelMetrics";
import { normalizeFunnelData } from "../src/funnel-analysis/adapters/normalizeFunnelData";
import { standardFunnelFixture } from "./fixtures";

const normalized = normalizeFunnelData(standardFunnelFixture);
const placeholderVms = normalized.stages.map((stage) => ({
  stage,
  count: 0,
  cumulativeConversion: null,
  stageToStageConversion: null,
  dropOff: null,
}));
const transitions = computeTransitions(placeholderVms);
const allIds = transitions.map((t) => t.id);
const initial = createInitialState(allIds, { granularity: "weekly" });

describe("funnelAnalysisReducer", () => {
  it("initial state: nothing selected, all series visible", () => {
    expect(initial.selectedStageId).toBeNull();
    expect(initial.selectedTransitionId).toBeNull();
    expect(initial.visibleSeriesIds).toEqual(allIds);
    expect(initial.granularity).toBe("weekly");
  });

  it("stage selection clears transition selection (mutual exclusivity)", () => {
    const withTransition = funnelAnalysisReducer(initial, {
      type: "selectTransition",
      transitionId: "visitors->views",
    });
    const withStage = funnelAnalysisReducer(withTransition, {
      type: "selectStage",
      stageId: "cart",
    });
    expect(withStage.selectedStageId).toBe("cart");
    expect(withStage.selectedTransitionId).toBeNull();
  });

  it("transition selection clears stage selection", () => {
    const withStage = funnelAnalysisReducer(initial, {
      type: "selectStage",
      stageId: "cart",
    });
    const withTransition = funnelAnalysisReducer(withStage, {
      type: "selectTransition",
      transitionId: "views->cart",
    });
    expect(withTransition.selectedTransitionId).toBe("views->cart");
    expect(withTransition.selectedStageId).toBeNull();
  });

  it("hover never mutates selection", () => {
    const withStage = funnelAnalysisReducer(initial, {
      type: "selectStage",
      stageId: "cart",
    });
    const hovered = funnelAnalysisReducer(withStage, {
      type: "hoverStage",
      stageId: "purchase",
    });
    expect(hovered.selectedStageId).toBe("cart");
    expect(hovered.hoveredStageId).toBe("purchase");
  });

  it("legend visibility never changes selection", () => {
    const withStage = funnelAnalysisReducer(initial, {
      type: "selectStage",
      stageId: "cart",
    });
    const hidden = funnelAnalysisReducer(withStage, {
      type: "setSeriesVisibility",
      seriesIds: ["visitors->views"],
    });
    expect(hidden.selectedStageId).toBe("cart");
    expect(hidden.visibleSeriesIds).toEqual(["visitors->views"]);
  });

  it("filter change invalidates selections outside valid ids", () => {
    const withStage = funnelAnalysisReducer(initial, {
      type: "selectStage",
      stageId: "cart",
    });
    const filtered = funnelAnalysisReducer(withStage, {
      type: "setFilters",
      filters: { granularity: "monthly" },
      validStageIds: ["visitors", "views"], // cart no longer valid
      validTransitionIds: ["visitors->views"],
    });
    expect(filtered.selectedStageId).toBeNull();
    expect(filtered.granularity).toBe("monthly");
    expect(filtered.visibleSeriesIds).toEqual(["visitors->views"]);
  });

  it("reset restores defaults: no selection, all series visible", () => {
    const dirty = funnelAnalysisReducer(
      funnelAnalysisReducer(initial, {
        type: "selectStage",
        stageId: "cart",
      }),
      { type: "setSeriesVisibility", seriesIds: ["visitors->views"] },
    );
    const reset = funnelAnalysisReducer(dirty, {
      type: "reset",
      allSeriesIds: allIds,
      defaults: { granularity: "weekly" },
    });
    expect(reset).toEqual(initial);
  });
});

describe("coordinator pure helpers", () => {
  it("adjacentTransitionIds: incoming + outgoing of a middle stage", () => {
    expect(adjacentTransitionIds("cart", transitions)).toEqual([
      "views->cart",
      "cart->checkout",
    ]);
    expect(adjacentTransitionIds("visitors", transitions)).toEqual([
      "visitors->views",
    ]);
  });

  it("focusStageIds: stage selection → [stage]; transition selection → both stages", () => {
    expect(
      focusStageIds({ selectedStageId: "cart", selectedTransitionId: null }, transitions),
    ).toEqual(["cart"]);
    expect(
      focusStageIds(
        { selectedStageId: null, selectedTransitionId: "views->cart" },
        transitions,
      ),
    ).toEqual(["views", "cart"]);
    expect(
      focusStageIds({ selectedStageId: null, selectedTransitionId: null }, transitions),
    ).toEqual([]);
  });

  it("focusTransitionIds: transition selection → [it]; stage selection → adjacent", () => {
    expect(
      focusTransitionIds(
        { selectedStageId: null, selectedTransitionId: "views->cart" },
        transitions,
      ),
    ).toEqual(["views->cart"]);
    expect(
      focusTransitionIds({ selectedStageId: "cart", selectedTransitionId: null }, transitions),
    ).toEqual(["views->cart", "cart->checkout"]);
  });

  it("legendSelectionToVisibility maps series NAMES back to IDs", () => {
    expect(
      legendSelectionToVisibility(
        {
          "Visitors → Views": true,
          "Views → Cart": false,
          "Cart → Checkout": true,
          "Checkout → Purchase": false,
        },
        transitions,
        normalized.stages,
      ),
    ).toEqual(["visitors->views", "cart->checkout"]);
  });
});

// ---------------------------------------------------------------------------
// Integration scenarios (spec §6 Interaction Contract + Test Spec §B)
// ---------------------------------------------------------------------------

describe("useFunnelInteraction — integration scenarios", () => {
  function setup() {
    const events: string[] = [];
    const onStageSelect = vi.fn();
    const onTransitionSelect = vi.fn();
    const onSeriesVisibilityChange = vi.fn();
    const onFilterChange = vi.fn();
    const onReset = vi.fn();
    const hook = renderHook(() =>
      useFunnelInteraction({
        stages: normalized.stages,
        transitions,
        onStageSelect,
        onTransitionSelect,
        onSeriesVisibilityChange,
        onFilterChange,
        onReset,
        onEvent: (e) => events.push(e.type),
      }),
    );
    return {
      hook,
      events,
      onStageSelect,
      onTransitionSelect,
      onSeriesVisibilityChange,
      onFilterChange,
      onReset,
    };
  }

  it("Scenario A — select funnel stage → adjacent trend series highlighted", () => {
    const { hook } = setup();
    act(() => {
      hook.result.current.selectStage("cart");
    });
    expect(hook.result.current.state.selectedStageId).toBe("cart");
    expect(focusTransitionIds(hook.result.current.state, transitions)).toEqual([
      "views->cart",
      "cart->checkout",
    ]);
    // Other series remain visible — subdued, not removed.
    expect(hook.result.current.state.visibleSeriesIds).toEqual(allIds);
  });

  it("Scenario B — select trend transition → both stages highlighted", () => {
    const { hook } = setup();
    act(() => {
      hook.result.current.selectTransition("checkout->purchase");
    });
    expect(focusStageIds(hook.result.current.state, transitions)).toEqual([
      "checkout",
      "purchase",
    ]);
  });

  it("Scenario C — change date range → filter state updates both panels", () => {
    const { hook, onFilterChange } = setup();
    act(() => {
      hook.result.current.setFilters({
        dateRange: { from: "2026-01-01", to: "2026-03-31" },
      });
    });
    expect(hook.result.current.state.dateRange).toEqual({
      from: "2026-01-01",
      to: "2026-03-31",
    });
    expect(onFilterChange).toHaveBeenCalledOnce();
  });

  it("change granularity regroups trend data source", () => {
    const { hook } = setup();
    act(() => {
      hook.result.current.setFilters({ granularity: "monthly" });
    });
    expect(hook.result.current.state.granularity).toBe("monthly");
  });

  it("toggle legend → series visibility updates, selection untouched", () => {
    const { hook, onSeriesVisibilityChange } = setup();
    act(() => {
      hook.result.current.selectStage("cart");
    });
    act(() => {
      hook.result.current.setSeriesVisibility(["visitors->views"]);
    });
    expect(hook.result.current.state.visibleSeriesIds).toEqual(["visitors->views"]);
    expect(hook.result.current.state.selectedStageId).toBe("cart");
    expect(onSeriesVisibilityChange).toHaveBeenCalledWith(["visitors->views"]);
  });

  it("reset → selection and visibility restored", () => {
    const { hook, onReset } = setup();
    act(() => {
      hook.result.current.selectStage("cart");
      hook.result.current.setSeriesVisibility(["visitors->views"]);
    });
    act(() => {
      hook.result.current.reset();
    });
    expect(hook.result.current.state.selectedStageId).toBeNull();
    expect(hook.result.current.state.visibleSeriesIds).toEqual(allIds);
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("chart click on funnel series toggles stage selection", () => {
    const { hook, onStageSelect } = setup();
    act(() => {
      hook.result.current.chartHandlers.click({
        seriesId: "funnel-stages",
        data: { id: "cart" },
      });
    });
    expect(hook.result.current.state.selectedStageId).toBe("cart");
    expect(onStageSelect).toHaveBeenCalledWith(
      normalized.stages.find((s) => s.id === "cart"),
    );
    act(() => {
      hook.result.current.chartHandlers.click({
        seriesId: "funnel-stages",
        data: { id: "cart" },
      });
    });
    expect(hook.result.current.state.selectedStageId).toBeNull();
  });

  it("chart click on trend series selects transition; legend event maps names→ids", () => {
    const { hook } = setup();
    act(() => {
      hook.result.current.chartHandlers.click({ seriesId: "views->cart" });
    });
    expect(hook.result.current.state.selectedTransitionId).toBe("views->cart");

    act(() => {
      hook.result.current.chartHandlers.legendselectchanged({
        selected: {
          "Visitors → Views": true,
          "Views → Cart": true,
          "Cart → Checkout": false,
          "Checkout → Purchase": true,
        },
      });
    });
    expect(hook.result.current.state.visibleSeriesIds).toEqual([
      "visitors->views",
      "views->cart",
      "checkout->purchase",
    ]);
  });

  it("hover is independent from selection and cleared on mouseout", () => {
    const { hook } = setup();
    act(() => {
      hook.result.current.selectStage("cart");
      hook.result.current.chartHandlers.mouseover({
        seriesId: "funnel-stages",
        data: { id: "purchase" },
      });
    });
    expect(hook.result.current.state.hoveredStageId).toBe("purchase");
    expect(hook.result.current.state.selectedStageId).toBe("cart");
    act(() => {
      hook.result.current.chartHandlers.mouseout({});
    });
    expect(hook.result.current.state.hoveredStageId).toBeNull();
  });

  it("controlled selection: parent prop wins over internal state", () => {
    const { result, rerender } = renderHook(
      ({ selection }: { selection?: { selectedStageId?: string | null } }) =>
        useFunnelInteraction({
          stages: normalized.stages,
          transitions,
          selection,
        }),
      { initialProps: { selection: { selectedStageId: "purchase" as string | null } } },
    );
    expect(result.current.state.selectedStageId).toBe("purchase");
    // Internal dispatch happens but parent prop remains the truth.
    act(() => {
      result.current.selectStage("cart");
    });
    expect(result.current.state.selectedStageId).toBe("purchase");
    rerender({ selection: { selectedStageId: "cart" } });
    expect(result.current.state.selectedStageId).toBe("cart");
  });

  it("emits application-level events through onEvent", () => {
    const { hook, events } = setup();
    act(() => {
      hook.result.current.selectStage("cart");
      hook.result.current.setSeriesVisibility(allIds);
      hook.result.current.reset();
    });
    expect(events).toEqual([
      "stage.select",
      "series.visibility.change",
      "selection.reset",
    ]);
  });
});
