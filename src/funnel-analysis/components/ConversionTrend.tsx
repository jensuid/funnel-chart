import { useMemo } from "react";
import type {
  FunnelStage,
  FunnelTransitionViewModel,
} from "../types/funnelAnalysis.types";
import type {
  FunnelAnalysisTheme,
  TrendChartConfig,
} from "../types/api.types";
import { createTrendOption } from "../charts/createTrendOption";
import { EChartsWrapper } from "./EChartsWrapper";
import type { FunnelInteractionApi } from "../state/interactionCoordinator";

export interface ConversionTrendProps {
  trend: {
    period: string;
    transitionId: string;
    conversionRate: number | null;
  }[];
  transitions: FunnelTransitionViewModel[];
  stages: FunnelStage[];
  interaction: FunnelInteractionApi;
  /** Computed by the composite via focusTransitionIds(). */
  highlightedTransitionIds: string[];
  theme?: FunnelAnalysisTheme;
  config?: TrendChartConfig;
  showLegend?: boolean;
  animation?: boolean;
}

export function ConversionTrend({
  trend,
  transitions,
  stages,
  interaction,
  highlightedTransitionIds,
  theme,
  config,
  showLegend = true,
  animation = true,
}: ConversionTrendProps) {
  const option = useMemo(
    () =>
      createTrendOption({
        trend,
        transitions,
        stages,
        visibleSeriesIds: interaction.state.visibleSeriesIds,
        highlightedTransitionIds,
        hoveredTransitionId: interaction.state.hoveredTransitionId,
        theme,
        config: showLegend ? config : { ...config, legendPosition: "bottom" },
        animation,
      }),
    [trend, transitions, stages, interaction, highlightedTransitionIds, theme, config, showLegend, animation],
  );

  const onEvents = useMemo(() => {
    const all = { ...interaction.chartHandlers } as Record<
      string,
      (params: unknown) => void
    >;
    if (showLegend) return all;
    // Legend hidden → legendselectchanged cannot fire; keep other handlers.
    return Object.fromEntries(
      Object.entries(all).filter(([event]) => event !== "legendselectchanged"),
    );
  }, [interaction, showLegend]);

  return (
    <section className="fa-panel fa-trend-panel" aria-label="Conversion rate trend">
      <h3>Conversion Rate Trend</h3>
      <div className="fa-chart-frame fa-trend-frame">
        <EChartsWrapper
          option={option}
          onEvents={onEvents}
          ariaLabel="Conversion rate trend chart, one series per funnel transition"
        />
      </div>
    </section>
  );
}
