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
  /**
   * Measured chart-frame width (px). Enables horizontal-funnel decisions:
   * whether all outside labels fit in one row above the funnel (else they
   * alternate above/below).
   */
  containerWidth?: number;
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
    containerWidth,
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
        : {
            // No takeover and no incoming transition (first stage) → nothing
            // to show: an empty label would still draw a stray leader line.
            label: {
              show:
                dropOffLabelsVisible &&
                stages[index]!.stageToStageConversion !== null,
            },
          }),
    };
  });

  const formatter = (d: TransitionLabelDatum): string => {
    // Takeover: show the stage's own label in this outside slot.
    if (d.takeoverText) return d.takeoverText;
    if (d.incomingConversion === null && d.incomingDropOff === null) {
      return ""; // first stage has no incoming transition
    }
    // Single short line — the cumulative conversion is already shown by the
    // main inside label, so only the drop-off metric lives here. The ↓ arrow
    // carries the meaning; short text keeps the label inside the plot even
    // next to wide bars.
    return `↓ ${formatPercent(d.incomingDropOff)}`;
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
    // Mirror the main series' explicit layout insets.
    ...(orient === "vertical"
      ? { top: 12, bottom: 12, left: "center", width: "92%" }
      : { left: 12, right: 12, top: "middle", height: "80%" }),
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
      ? // Custom stagger for both orientations: labels anchored clear of the
        // funnel with guaranteed gaps, cascading in the flow-perpendicular
        // direction only (down for vertical, right for horizontal).
        createOutsideLabelLayout(data, {
          leaderLength: 24,
          minGap: outsideLabelGap,
          orient,
          fontSize: data.length > 8 ? 10 : 11,
          estimateWidth: (d) => formatter(d).length * (data.length > 8 ? 10 : 11) * 0.58,
          // Horizontal: alternate above/below when one row cannot fit all
          // labels (needs the measured container width to decide).
          alternateRows:
            orient === "horizontal" &&
            containerWidth !== undefined &&
            data.reduce((sum, d) => sum + formatter(d).length * (data.length > 8 ? 10 : 11) * 0.58 + outsideLabelGap, 0) >
              containerWidth - 24,
        })
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
  /** Distance from the bar edge to the label text (px). */
  leaderLength: number;
  /** Minimum gap between staggered labels (px). */
  minGap: number;
  /** Fallback label height when the layout rect is not yet measured. */
  fallbackLabelHeight?: number;
  /** Fallback label width for horizontal cascades (px). */
  fallbackLabelWidth?: number;
  /** Funnel flow direction. Defaults to "vertical". */
  orient?: "vertical" | "horizontal";
  /**
   * Horizontal only: alternate outside labels above/below the funnel when a
   * single row cannot fit them all (computed at build time from the measured
   * container width). Vertical layout ignores this.
   */
  alternateRows?: boolean;
  /** Label font size — used to estimate rendered text width for clamping. */
  fontSize?: number;
  /** Returns the label's text so its rendered width can be estimated. */
  estimateWidth?: (d: TransitionLabelDatum) => number;
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
  const {
    leaderLength,
    minGap,
    fallbackLabelHeight = 20,
    fallbackLabelWidth = 80,
    orient = "vertical",
    fontSize = 11,
    estimateWidth,
    alternateRows = false,
  } = options;
  // Vertical: previous label's bottom edge. Horizontal: per-row right edges.
  let prevEdge: number | null = null;
  let prevEdgeAbove: number | null = null;
  let prevEdgeBelow: number | null = null;
  let lastIndex = -1;

  return (params) => {
    const d = data[params.dataIndex];
    const rect = params.rect;
    // ECharts re-runs label layout (animation frames, resize, hover). The
    // cascade state must RESET on every new pass — track pass boundaries by
    // dataIndex going backwards.
    if (params.dataIndex <= lastIndex) {
      prevEdge = null;
      prevEdgeAbove = null;
      prevEdgeBelow = null;
    }
    lastIndex = params.dataIndex;
    if (!d || !rect) return;
    const isTakeover = !!d.takeoverText;
    const isDropOff = !isTakeover && d.incomingConversion !== null;
    if (!isTakeover && !isDropOff) return; // hidden/empty labels untouched

    if (orient === "horizontal") {
      // Horizontal funnel: bands sit side by side, heights ∝ value. Labels
      // anchor above their band's top edge (or below the bottom edge when
      // alternating) and cascade RIGHTWARD within their row.
      const centerX = rect.x + rect.width / 2;
      const labelWidth = params.labelRect?.width ?? fallbackLabelWidth;
      const above = !alternateRows || params.dataIndex % 2 === 0;
      // Clamp the above-row inside the canvas top: the tallest band sits
      // close to the frame's top inset, so a full-length leader would push
      // its label off-canvas. Shorten the leader instead.
      const targetY = above
        ? Math.max(rect.y - leaderLength, fallbackLabelHeight + 2)
        : rect.y + rect.height + leaderLength;
      const rowPrev = above ? prevEdgeAbove : prevEdgeBelow;
      let x = centerX;
      if (rowPrev !== null && x - labelWidth / 2 < rowPrev + minGap) {
        x = rowPrev + minGap + labelWidth / 2;
      }
      // Keep the label inside the plot: the funnel's right edge can be
      // derived from the band's own rect (bands share the same center axis
      // perpendicular to the flow): halfExtent = ownExtent / relativeWidth.
      const maxValue = Math.max(...data.map((v) => v.value), 1);
      const relative = (d.value / maxValue) * 100;
      const plotRight =
        relative > 0 ? centerX + rect.width / 2 / (relative / 100) : centerX;
      const maxCenter = plotRight - labelWidth / 2 - 2;
      const minCenter = labelWidth / 2 + 2;
      x = Math.min(Math.max(x, minCenter), Math.max(maxCenter, minCenter));
      if (above) prevEdgeAbove = x + labelWidth / 2;
      else prevEdgeBelow = x + labelWidth / 2;

      const elbowY = above
        ? rect.y - leaderLength * 0.5
        : rect.y + rect.height + leaderLength * 0.5;
      const anchorY = above ? rect.y : rect.y + rect.height;
      const labelEdgeY = above ? targetY + 2 : targetY - 2;
      const labelLinePoints =
        Math.abs(x - centerX) < 1
          ? [
              [centerX, anchorY],
              [centerX, labelEdgeY],
            ]
          : [
              [centerX, anchorY],
              [centerX, elbowY],
              [x, labelEdgeY],
            ];
      return {
        x,
        y: targetY,
        align: "center" as const,
        verticalAlign: above ? ("bottom" as const) : ("top" as const),
        labelLinePoints,
      };
    }

    // Vertical funnel: bands stack top→bottom, widths ∝ value. Anchor the
    // label right of its OWN bar edge and cascade DOWNWARD only.
    const labelHeight = params.labelRect?.height ?? fallbackLabelHeight;
    const barEdgeX = rect.x + rect.width;
    const barCenterY = rect.y + rect.height / 2;
    // Clamp inside the plot: estimate the rendered text width and keep the
    // label's left edge within the funnel's outer extent (derivable from the
    // bar's own rect: halfExtent = ownWidth / relativeWidth).
    let leader = leaderLength;
    if (estimateWidth) {
      const maxValue = Math.max(...data.map((v) => v.value), 1);
      const relative = (d.value / maxValue) * 100;
      const centerX = rect.x + rect.width / 2;
      const funnelHalfWidth =
        relative > 0 ? rect.width / 2 / (relative / 100) : 0;
      const plotRight = centerX + funnelHalfWidth;
      const textWidth = estimateWidth(d);
      const maxLabelLeft = plotRight - textWidth - 2;
      if (barEdgeX + leader > maxLabelLeft) {
        leader = Math.max(4, maxLabelLeft - barEdgeX);
      }
    }
    const targetX = barEdgeX + leader;

    let y = barCenterY;
    if (prevEdge !== null && y - labelHeight / 2 < prevEdge + minGap) {
      y = prevEdge + minGap + labelHeight / 2;
    }
    // The last stage's band bottom IS the funnel bottom — never cascade
    // past it (prevents the bottom label being clipped by the chart edge).
    if (params.dataIndex === data.length - 1) {
      y = Math.min(y, rect.y + rect.height + 6);
    }
    prevEdge = y + labelHeight / 2;

    const labelCenterY = y;
    const labelLinePoints =
      Math.abs(labelCenterY - barCenterY) < 1
        ? [
            [barEdgeX, barCenterY],
            [targetX - 4, barCenterY],
          ]
        : [
            [barEdgeX, barCenterY],
            [barEdgeX + leader * 0.5, barCenterY],
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
