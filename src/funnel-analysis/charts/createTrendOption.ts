import type {
  FunnelStage,
  FunnelTrendPoint,
  FunnelTransitionViewModel,
} from "../types/funnelAnalysis.types";
import type {
  FunnelAnalysisTheme,
  TrendChartConfig,
} from "../types/api.types";
import type { EChartsCoreOption } from "./echartsSetup";
import { resolveTheme, transitionColor, accessibleStroke } from "./chartTheme";
import { createTrendTooltipFormatter, type TooltipSeriesMeta } from "./tooltipFormatter";

/**
 * Trend option factory — one line series per transition, built by transition
 * ID (never by array position). Color = destination stage color (D2).
 * Y-axis fixed 0–100 so interpretation stays comparable across periods.
 * Missing periods are null gaps (connectNulls: false by default) — never 0.
 */

export interface CreateTrendOptionInput {
  trend: FunnelTrendPoint[];
  transitions: FunnelTransitionViewModel[];
  stages: FunnelStage[];
  /** Legend state owned by React; regenerated into `legend.selected`. */
  visibleSeriesIds: string[];
  /** Transitions to emphasize: a selected transition, or in/out transitions of a selected stage. */
  highlightedTransitionIds: string[];
  hoveredTransitionId?: string | null;
  theme?: FunnelAnalysisTheme;
  config?: TrendChartConfig;
  animation?: boolean;
  animationDurationMs?: number;
}

export function trendSeriesName(
  transition: FunnelTransitionViewModel,
  stages: FunnelStage[],
): string {
  const label = (id: string) => stages.find((s) => s.id === id)?.label ?? id;
  return `${label(transition.fromStageId)} → ${label(transition.toStageId)}`;
}

/** Destination-stage index (0-based) in stage order — drives the color (D2). */
function destinationIndex(
  transition: FunnelTransitionViewModel,
  stages: FunnelStage[],
): number {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  return sorted.findIndex((s) => s.id === transition.toStageId);
}

/** Sorted unique periods in first-appearance order (trend is bucket-ordered). */
export function trendPeriods(trend: FunnelTrendPoint[]): string[] {
  const seen = new Set<string>();
  const periods: string[] = [];
  for (const point of trend) {
    if (!seen.has(point.period)) {
      seen.add(point.period);
      periods.push(point.period);
    }
  }
  return periods.sort((a, b) => a.localeCompare(b));
}

export function createTrendOption(
  input: CreateTrendOptionInput,
): EChartsCoreOption {
  const {
    trend,
    transitions,
    stages,
    visibleSeriesIds,
    highlightedTransitionIds,
    hoveredTransitionId,
    theme,
    config,
    animation = true,
    animationDurationMs = 300,
  } = input;

  const tokens = resolveTheme(theme);
  const periods = trendPeriods(trend);
  const visible = new Set(visibleSeriesIds);

  const rateByKey = new Map<string, number | null>();
  for (const point of trend) {
    rateByKey.set(`${point.period}::${point.transitionId}`, point.conversionRate);
  }

  const highlighted = new Set(highlightedTransitionIds);
  const hasHighlight = highlighted.size > 0;
  const lineWidth = config?.lineWidth ?? 2.5;
  const symbolSize = config?.symbolSize ?? 6;

  const seriesMeta: TooltipSeriesMeta[] = [];

  const series = transitions.map((transition) => {
    const stageIndex = destinationIndex(transition, stages);
    const color = transitionColor(stageIndex, theme);
    const name = trendSeriesName(transition, stages);
    seriesMeta.push({ id: transition.id, name, color });

    const isHighlighted = highlighted.has(transition.id);
    const isHovered = hoveredTransitionId === transition.id;
    // Subdued, NOT removed (spec Scenario A).
    const subdued = hasHighlight && !isHighlighted;

    const data = periods.map((period) => {
      const rate = rateByKey.get(`${period}::${transition.id}`);
      return rate === undefined ? null : rate;
    });

    return {
      id: transition.id,
      name,
      type: "line",
      data,
      itemStyle: { color },
      lineStyle: {
        // WCAG 1.4.11: line stroke meets 3:1 on the light background.
        color: accessibleStroke(stageIndex, theme),
        width: isHighlighted || isHovered ? lineWidth + 1 : lineWidth,
        ...(subdued ? { opacity: 0.25 } : {}),
      },
      emphasis: {
        disabled: false,
        lineStyle: { width: lineWidth + 1 },
      },
      symbol: "circle",
      symbolSize,
      smooth: config?.smooth ?? false,
      connectNulls: config?.connectNulls ?? false,
      showSymbol: config?.showSymbols ?? true,
      ...(config?.showArea
        ? { areaStyle: { color, opacity: 0.08 } }
        : {}),
      ...(config?.showDataLabels
        ? {
            label: {
              show: true,
              formatter: (p: { value: number | null }) =>
                p.value === null ? "" : `${p.value.toFixed(1)}%`,
              color: tokens.mutedTextColor,
              fontSize: 10,
            },
          }
        : {}),
      animation,
    };
  });

  // ECharts keys legend state by series NAME, not id.
  const legendSelected: Record<string, boolean> = {};
  for (const transition of transitions) {
    const name = trendSeriesName(transition, stages);
    legendSelected[name] = visible.has(transition.id);
  }

  const tooltipFormatter = createTrendTooltipFormatter({
    seriesMeta,
    visibleSeriesIds,
  });

  return {
    animation,
    animationDuration: animationDurationMs,
    grid: { left: 48, right: 16, top: config?.legendPosition === "bottom" ? 16 : 36, bottom: config?.legendPosition === "bottom" ? 48 : 28 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line" },
      formatter: tooltipFormatter,
    },
    legend: {
      type: "scroll",
      ...(config?.legendPosition === "bottom" ? { bottom: 0 } : { top: 0 }),
      selected: legendSelected,
      textStyle: { color: tokens.textColor, fontFamily: tokens.fontFamily },
      inactiveColor: tokens.gridColor,
    },
    xAxis: {
      type: "category",
      data: periods,
      axisLine: { lineStyle: { color: tokens.gridColor } },
      axisLabel: { color: tokens.mutedTextColor, fontFamily: tokens.fontFamily },
    },
    yAxis: {
      type: "value",
      min: config?.yAxisMin ?? 0,
      max: config?.yAxisMax ?? 100,
      axisLabel: {
        formatter: "{value}%",
        color: tokens.mutedTextColor,
        fontFamily: tokens.fontFamily,
      },
      splitLine: { lineStyle: { color: tokens.gridColor, type: "dashed" } },
    },
    ...(config?.showZoom
      ? {
          dataZoom: [
            { type: "inside" },
            { type: "slider", height: 16, bottom: 8 },
          ],
        }
      : {}),
    series,
  };
}
