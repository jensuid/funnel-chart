import { useMemo } from "react";
import type { FunnelStageViewModel } from "../types/funnelAnalysis.types";
import type {
  FunnelAnalysisTheme,
  FunnelChartConfig,
} from "../types/api.types";
import { createFunnelOption } from "../charts/createFunnelOption";
import { EChartsWrapper } from "./EChartsWrapper";
import type { FunnelInteractionApi } from "../state/interactionCoordinator";

export interface FunnelOverviewProps {
  stages: FunnelStageViewModel[];
  interaction: FunnelInteractionApi;
  /** Computed by the composite via focusStageIds(). */
  selectedStageIds: string[];
  theme?: FunnelAnalysisTheme;
  config?: FunnelChartConfig;
  showStageLabels?: boolean;
  showCumulativeConversion?: boolean;
  showDropOff?: boolean;
  animation?: boolean;
}

export function FunnelOverview({
  stages,
  interaction,
  selectedStageIds,
  theme,
  config,
  showStageLabels = true,
  showCumulativeConversion = true,
  showDropOff = true,
  animation = true,
}: FunnelOverviewProps) {
  const option = useMemo(
    () =>
      createFunnelOption({
        stages,
        selectedStageIds,
        hoveredStageId: interaction.state.hoveredStageId,
        theme,
        config,
        showCumulativeConversion,
        showValues: showStageLabels,
        showDropOffIndicators: showDropOff,
        animation,
      }),
    [stages, selectedStageIds, interaction, theme, config, showStageLabels, showCumulativeConversion, showDropOff, animation],
  );

  return (
    <section className="fa-panel fa-funnel-panel" aria-label="Funnel overview">
      <h3>Funnel Overview</h3>
      <div className="fa-chart-frame">
        <EChartsWrapper
          option={option}
          onEvents={interaction.chartHandlers}
          ariaLabel="Funnel overview chart showing stage volumes and cumulative conversion"
        />
      </div>
    </section>
  );
}
