import { useMemo } from "react";
import type { FunnelAnalysisData } from "../types/funnelAnalysis.types";
import type { FunnelAnalysisProps, ValidationIssue } from "../types/api.types";
import { validateFunnelData } from "../validation/validateFunnelData";
import { normalizeFunnelData } from "../adapters/normalizeFunnelData";
import { filterPeriodsByRange } from "../adapters/filterPeriods";
import { aggregatePeriods, buildTrend } from "../metrics/aggregateTrendMetrics";
import {
  buildFunnelViewModel,
  computeTransitions,
} from "../metrics/calculateFunnelMetrics";
import { generateInsights } from "../insights/generateInsights";
import {
  focusStageIds,
  focusTransitionIds,
  useFunnelInteraction,
} from "../state/interactionCoordinator";
import { FunnelOverview } from "./FunnelOverview";
import { ConversionTrend } from "./ConversionTrend";
import { KeyInsights } from "./KeyInsights";
import { TrendSummary } from "./TrendSummary";
import "../funnel-analysis.css";

/**
 * FunnelAnalysis — composite component.
 * Funnel Overview + Key Insights + Conversion Rate Trend sharing one data
 * context and one interaction state (spec §1, §2).
 */
export function FunnelAnalysis({
  data,
  config,
  filters,
  selection,
  loading = false,
  error = null,
  onFilterChange,
  onStageSelect,
  onTransitionSelect,
  onSeriesVisibilityChange,
  onEvent,
  onReset,
  className,
  style,
}: FunnelAnalysisProps) {
  // 1. Validate first — invalid datasets never reach the charts.
  const validation = useMemo(
    () => validateFunnelData(data),
    [data],
  );

  // 2. Normalize + filter + aggregate (memoized pipeline).
  const model = useMemo(() => {
    if (!validation.valid) return null;
    const normalized = normalizeFunnelData(data);
    const dateRange = filters?.dateRange ?? config?.defaultDateRange ?? null;
    const scoped = filterPeriodsByRange(normalized.periods, dateRange);
    const stageIds = normalized.stages.map((s) => s.id);
    const granularity = filters?.granularity ?? config?.defaultGranularity ?? "daily";
    const buckets = aggregatePeriods(scoped, stageIds, granularity);
    const latest = buckets.at(-1);
    const funnelVm = latest
      ? buildFunnelViewModel(normalized, latest.observations)
      : null;
    const transitions = funnelVm?.transitions ?? [];
    const { trend, missingPeriods } = buildTrend(
      { ...normalized, periods: scoped },
      transitions,
      granularity,
    );
    return {
      normalized,
      granularity,
      buckets,
      latestBucket: latest?.bucket ?? null,
      funnelVm,
      transitions,
      trend,
      missingPeriods,
    };
  }, [data, filters?.dateRange, filters?.granularity, config?.defaultDateRange, config?.defaultGranularity, validation.valid]);

  // 3. Shared interaction state.
  const interaction = useFunnelInteraction({
    stages: data.stages,
    transitions: model?.transitions ?? [],
    config,
    filters,
    selection,
    onFilterChange,
    onStageSelect,
    onTransitionSelect,
    onSeriesVisibilityChange,
    onEvent,
    onReset,
  });

  // 4. Insights from the latest bucket + trend.
  const insights = useMemo(() => {
    if (!model?.funnelVm) return [];
    const periods = [...new Set(model.trend.map((p) => p.period))];
    return generateInsights({
      stages: model.funnelVm.stages,
      transitions: model.funnelVm.transitions,
      trend: model.trend,
      periods,
      config: config?.insights,
    });
  }, [model, config?.insights]);

  const selectedStageIds = useMemo(
    () => focusStageIds(interaction.state, model?.transitions ?? []),
    [interaction.state, model?.transitions],
  );
  const highlightedTransitionIds = useMemo(
    () => focusTransitionIds(interaction.state, model?.transitions ?? []),
    [interaction.state, model?.transitions],
  );

  const layout = config?.layout ?? "default";
  const classNames = ["funnel-analysis", `fa-layout-${layout}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames} style={style} data-testid="funnel-analysis">
      {config?.showHeader !== false && (
        <header className="fa-header">
          <h2>{data.name}</h2>
          {loading && <span className="fa-loading-badge" aria-live="polite">Updating…</span>}
        </header>
      )}

      {error ? (
        <ErrorState error={error} />
      ) : !validation.valid ? (
        <InvalidState issues={validation.issues} />
      ) : !model || model.buckets.length === 0 ? (
        <EmptyState hasPeriods={data.periods.length > 0} />
      ) : (
        <>
          {model.missingPeriods.length > 0 && (
            <div className="fa-warning-banner" role="status">
              Partial data: {model.missingPeriods.length} bucket
              {model.missingPeriods.length === 1 ? "" : "s"} missing stage observations.
            </div>
          )}
          <div className="fa-grid">
            {model.funnelVm && (
              <FunnelOverview
                stages={model.funnelVm.stages}
                interaction={interaction}
                selectedStageIds={selectedStageIds}
                theme={config?.theme}
                config={config?.funnel}
                showStageLabels={config?.showStageLabels}
                showCumulativeConversion={config?.showCumulativeConversion}
                showDropOff={config?.showDropOff}
                animation={config?.animation?.enabled}
              />
            )}
            {config?.showInsights !== false && (
              <KeyInsights insights={insights} loading={loading} />
            )}
            <ConversionTrend
              trend={model.trend}
              transitions={model.transitions}
              stages={model.normalized.stages}
              interaction={interaction}
              highlightedTransitionIds={highlightedTransitionIds}
              theme={config?.theme}
              config={config?.trend}
              showLegend={config?.showLegend}
              animation={config?.animation?.enabled}
            />
            {config?.showTrendSummary !== false && model.funnelVm && (
              <TrendSummary
                viewModel={{ ...model.funnelVm, trend: model.trend }}
                periods={[...new Set(model.trend.map((p) => p.period))]}
                granularity={model.granularity}
                missingPeriods={model.missingPeriods}
                loading={loading}
              />
            )}
          </div>
          {config?.showDataTable && (
            <DataTable stages={model.funnelVm!.stages} />
          )}
        </>
      )}
    </div>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <div className="fa-state fa-error" role="alert">
      <h3>Something went wrong</h3>
      <p>{error.message}</p>
    </div>
  );
}

function InvalidState({ issues }: { issues: ValidationIssue[] }) {
  return (
    <div className="fa-state fa-invalid" role="alert">
      <h3>Invalid data</h3>
      <ul>
        {issues
          .filter((i) => i.severity === "error")
          .map((i, idx) => (
            <li key={idx}>
              <strong>{i.code}</strong>: {i.message}
            </li>
          ))}
      </ul>
    </div>
  );
}

function EmptyState({ hasPeriods }: { hasPeriods: boolean }) {
  return (
    <div className="fa-state fa-empty">
      <h3>{hasPeriods ? "No matching data" : "No data yet"}</h3>
      <p>
        {hasPeriods
          ? "No periods fall within the current filters. Try widening the date range."
          : "This dataset has no period observations."}
      </p>
    </div>
  );
}

function DataTable({ stages }: { stages: NonNullable<ReturnType<typeof buildFunnelViewModel>>["stages"] }) {
  return (
    <table className="fa-data-table" aria-label="Funnel data table">
      <thead>
        <tr>
          <th scope="col">Stage</th>
          <th scope="col">Volume</th>
          <th scope="col">Cumulative</th>
          <th scope="col">Stage conversion</th>
          <th scope="col">Drop-off</th>
        </tr>
      </thead>
      <tbody>
        {stages.map((s) => (
          <tr key={s.stage.id}>
            <th scope="row">{s.stage.label}</th>
            <td>{s.count.toLocaleString("en-US")}</td>
            <td>{fmt(s.cumulativeConversion)}</td>
            <td>{fmt(s.stageToStageConversion)}</td>
            <td>{fmt(s.dropOff)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function fmt(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(1)}%`;
}
