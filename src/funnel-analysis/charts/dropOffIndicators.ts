import type { FunnelStageViewModel } from "../types/funnelAnalysis.types";
import type { FunnelAnalysisTheme } from "../types/api.types";
import type { ThemeTokens } from "./chartTheme";
import { formatCount, formatPercent } from "./createFunnelOption";

/**
 * D3 — drop-off indicators.
 *
 * ECharts' funnel series has no native "between stages" metric display, so
 * transition metrics are rendered as OUTSIDE labels of a second, fully
 * transparent funnel series sharing the same layout (identical sort/min/max/
 * gap ⇒ identical shapes). The overlay series is silent: no tooltip, no
 * pointer events, no emphasis.
 */

export interface TransitionLabelDatum {
  stageId: string;
  name: string;
  /** Same value as the main series so both funnels align perfectly. */
  value: number;
  /** Transition ENDING at this stage (from previous stage). */
  incomingConversion: number | null;
  incomingDropOff: number | null;
  /** Stage's own label when the overlay carries it outside (auto strategy). */
  takeoverText?: string;
  itemStyle: { color: string };
}

export interface BuildTransitionLabelSeriesInput {
  stages: FunnelStageViewModel[];
  tokens: ThemeTokens;
  fontFamily: string;
  /** Layout mirrors of the MAIN series — required for perfect alignment. */
  sort: "descending" | "ascending" | "none";
  orient: "vertical" | "horizontal";
  minSize: number;
  maxSize: number;
  gap: number;
  /**
   * Stages whose label the overlay CARRIES to the outside slot (auto
   * strategy): the overlay shows the stage's own text instead of the
   * drop-off metrics, staggered with bent leader lines.
   */
  takeoverLabels?: Map<string, string>;
  /** Stagger outside labels vertically (moveOverlap shiftY) + leader lines. */
  stacked?: boolean;
  /** Overlay labels auto-hide above this stage count (crowding guard). */
  maxLabeledStages?: number;
}

export function buildTransitionLabelSeries(
  input: BuildTransitionLabelSeriesInput,
): Record<string, unknown> {
  const {
    stages,
    tokens,
    fontFamily,
    sort,
    orient,
    minSize,
    maxSize,
    gap,
    takeoverLabels,
    stacked,
    maxLabeledStages,
  } = input;

  // Density guard applies ONLY to drop-off metric labels — takeover stage
  // labels (stage identification) always show.
  const dropOffLabelsVisible =
    maxLabeledStages === undefined || stages.length <= maxLabeledStages;

  const data: TransitionLabelDatum[] = stages.map((vm, index) => {
    const incoming =
      index > 0
        ? {
            incomingConversion: vm.stageToStageConversion,
            incomingDropOff: vm.dropOff,
          }
        : { incomingConversion: null, incomingDropOff: null };
    return {
      stageId: vm.stage.id,
      name: vm.stage.label,
      value: vm.count,
      ...incoming,
      // Fully transparent — only labels are visible.
      itemStyle: { color: "transparent" },
      // Takeover: this stage's own label lives in the overlay's outside
      // slot (staggered), so show it here instead of the drop-off metrics.
      ...(takeoverLabels?.has(vm.stage.id)
        ? {
            takeoverText: takeoverLabels.get(vm.stage.id),
            label: {
              show: true,
              color: tokens.textColor,
              fontWeight: "bold" as const,
            },
          }
        : { label: { show: dropOffLabelsVisible } }),
    };
  });

  const formatter = (d: TransitionLabelDatum): string => {
    // Takeover: show the stage's own label in this outside slot.
    if (d.takeoverText) return d.takeoverText;
    if (d.incomingConversion === null && d.incomingDropOff === null) {
      return ""; // first stage has no incoming transition
    }
    const parts = [
      `→ ${formatPercent(d.incomingConversion)}`,
      `↓ ${formatPercent(d.incomingDropOff)} drop-off`,
    ];
    return parts.join("\n");
  };

  return {
    type: "funnel",
    id: "funnel-transition-labels",
    // Must mirror the main series exactly so shapes align.
    sort,
    orient,
    minSize: `${minSize}%`,
    maxSize: `${maxSize}%`,
    gap,
    z: 3,
    silent: true,
    data,
    label: {
      show: true,
      position: "outside",
      color: tokens.mutedTextColor,
      fontFamily,
      fontSize: 11,
      lineHeight: 14,
      formatter: (params: { data?: unknown }) =>
        formatter(params.data as TransitionLabelDatum),
    },
    labelLine: {
      show: !!stacked,
      length: 10,
      length2: 14,
      lineStyle: { color: tokens.mutedTextColor, width: 1 },
    },
    labelLayout: stacked
      ? { hideOverlap: false, moveOverlap: "shiftY" }
      : { hideOverlap: true },
    emphasis: { disabled: true },
    tooltip: { show: false },
    // Never interactive or animated independently.
    animation: false,
  };
}

/** Re-exported for tests: stage summary text used by the accessible fallback. */
export function describeStage(vm: FunnelStageViewModel): string {
  return `${vm.stage.label}: ${formatCount(vm.count)}, cumulative ${formatPercent(vm.cumulativeConversion)}`;
}
