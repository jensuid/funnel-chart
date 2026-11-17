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
  /**
   * Extra vertical breathing room (px, each side) around staggered outside
   * labels — enlarges each label's layout rect so moveOverlap shiftY spaces
   * them further apart. Default 6.
   */
  outsideLabelGap?: number;
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
    outsideLabelGap = 8,
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
    // Single line — keeps the staggered column compact and legible.
    return `→ ${formatPercent(d.incomingConversion)} · ↓ ${formatPercent(d.incomingDropOff)} drop-off`;
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
      // Dense funnels (>8 stages): smaller outside labels so the natural
      // band spacing already fits them — less cascade drift, no clipping.
      fontSize: data.length > 8 ? 10 : 11,
      lineHeight: data.length > 8 ? 13 : 16,
      // Slim padding — large vertical padding inflates layout rects and
      // compounds the stagger cascade on short funnels.
      padding: [2, 2, 2, 2],
      formatter: (params: { data?: unknown }) =>
        formatter(params.data as TransitionLabelDatum),
    },
    labelLine: {
      show: !!stacked,
      // Fallback leader lengths; the custom labelLayout callback (vertical +
      // stacked) rewrites the actual points per label.
      length: 18,
      length2: 28,
      lineStyle: { color: tokens.mutedTextColor, width: 1 },
    },
    labelLayout: stacked
      ? orient === "vertical"
        ? // Custom stagger: labels pushed beyond the funnel's outer edge
          // with guaranteed vertical gaps and bent leader lines.
          createOutsideLabelLayout(data, {
            leaderLength: 24,
            minGap: outsideLabelGap,
          })
        : { hideOverlap: false, moveOverlap: "shiftX" }
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

// ---------------------------------------------------------------------------
// Outside-label layout (vertical funnel)
// ---------------------------------------------------------------------------

export interface OutsideLabelLayoutOptions {
  /** Distance from the funnel's outer edge to the label text (px). */
  leaderLength: number;
  /** Minimum vertical gap between staggered labels (px). */
  minGap: number;
  /** Fallback label height when the layout rect is not yet measured. */
  fallbackLabelHeight?: number;
}

interface LabelLayoutParams {
  dataIndex: number;
  rect?: { x: number; y: number; width: number; height: number };
  labelRect?: { x: number; y: number; width: number; height: number };
}

/**
 * Deterministic outside-label layout for vertical funnels.
 *
 * ECharts' moveOverlap can shift labels UP into other bands' territory,
 * colliding with their inside labels. This callback instead:
 *
 *  1. anchors each label `leaderLength` right of its OWN bar edge (at the
 *     bar's own y there is only empty background, so this never hits a bar);
 *  2. staggers labels vertically with a GUARANTEED min gap, cascading
 *     DOWNWARD only — labels never jump up into other bands' territory;
 *  3. emits a straight leader line when the label sits level with its bar,
 *     a bent 3-point line when it was cascaded.
 *
 * The returned callback must be invoked by ECharts in data order (top to
 * bottom), which holds for funnel label layout.
 */
export function createOutsideLabelLayout(
  data: TransitionLabelDatum[],
  options: OutsideLabelLayoutOptions,
): (params: LabelLayoutParams) => Record<string, unknown> | undefined {
  const { leaderLength, minGap, fallbackLabelHeight = 20 } = options;
  let prevBottom: number | null = null;
  let lastIndex = -1;

  return (params) => {
    const d = data[params.dataIndex];
    const rect = params.rect;
    // ECharts re-runs label layout (animation frames, resize, hover). The
    // cascade state must RESET on every new pass — track pass boundaries by
    // dataIndex going backwards.
    if (params.dataIndex <= lastIndex) prevBottom = null;
    lastIndex = params.dataIndex;
    if (!d || !rect) return;
    const isTakeover = !!d.takeoverText;
    const isDropOff = !isTakeover && d.incomingConversion !== null;
    if (!isTakeover && !isDropOff) return; // hidden/empty labels untouched

    const labelHeight = params.labelRect?.height ?? fallbackLabelHeight;
    const barEdgeX = rect.x + rect.width;
    const barCenterY = rect.y + rect.height / 2;
    const targetX = barEdgeX + leaderLength;

    let y = barCenterY;
    if (prevBottom !== null && y - labelHeight / 2 < prevBottom + minGap) {
      y = prevBottom + minGap + labelHeight / 2;
    }
    prevBottom = y + labelHeight / 2;

    const labelCenterY = y;
    const labelLinePoints =
      Math.abs(labelCenterY - barCenterY) < 1
        ? [
            [barEdgeX, barCenterY],
            [targetX - 4, barCenterY],
          ]
        : [
            [barEdgeX, barCenterY],
            [barEdgeX + leaderLength * 0.5, barCenterY],
            [targetX - 4, labelCenterY],
          ];

    return {
      x: targetX,
      y: labelCenterY,
      align: "left" as const,
      verticalAlign: "middle" as const,
      labelLinePoints,
    };
  };
}
