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
}

export function buildTransitionLabelSeries(
  input: BuildTransitionLabelSeriesInput,
): Record<string, unknown> {
  const { stages, tokens, fontFamily, sort, orient, minSize, maxSize, gap } = input;

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
    };
  });

  const formatter = (d: TransitionLabelDatum): string => {
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
    labelLine: { show: false },
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
