import type { CSSProperties } from "react";
import type {
  DateRange,
  FunnelAnalysisData,
  FunnelStage,
  FunnelTransitionViewModel,
  FunnelTrendPoint,
  Granularity,
} from "./funnelAnalysis.types";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  code:
    | "MISSING_STAGE"
    | "DUPLICATE_STAGE_ID"
    | "INVALID_STAGE_ORDER"
    | "UNKNOWN_STAGE_REFERENCE"
    | "NEGATIVE_COUNT"
    | "NON_MONOTONIC_FUNNEL"
    | "ZERO_DENOMINATOR"
    | "MISSING_PERIOD_DATA"
    | "INCONSISTENT_COUNTING_UNIT"
    | "INCONSISTENT_COHORT";
  severity: ValidationSeverity;
  message: string;
  stageId?: string;
  period?: string;
}

export interface FunnelValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/** Policy for NON_MONOTONIC_FUNNEL. Structural/numerical issues are always strict. */
export type NonMonotonicPolicy = "strict" | "warning" | "allow";

// ---------------------------------------------------------------------------
// Configuration API
// ---------------------------------------------------------------------------

export interface FunnelAnalysisConfig {
  layout?: "default" | "compact" | "stacked";
  showHeader?: boolean;
  showInsights?: boolean;
  showDropOff?: boolean;
  showTrendSummary?: boolean;
  showStageLabels?: boolean;
  showCumulativeConversion?: boolean;
  showLegend?: boolean;
  showTooltips?: boolean;
  showDataTable?: boolean;
  defaultGranularity?: Granularity;
  defaultDateRange?: DateRange;
  funnel?: FunnelChartConfig;
  trend?: TrendChartConfig;
  insights?: InsightsConfig;
  animation?: AnimationConfig;
  theme?: FunnelAnalysisTheme;
}

export interface FunnelChartConfig {
  orientation?: "vertical" | "horizontal";
  sort?: "descending" | "ascending" | "none";
  gap?: number;
  minSize?: number;
  maxSize?: number;
  labelPosition?: "inside" | "outside";
  /** "auto" (default) moves narrow bars' labels outside; "fixed" keeps labelPosition. */
  labelStrategy?: "fixed" | "auto";
  /** Bar narrower than this % of the widest bar → label outside (auto mode). */
  labelOutsideThreshold?: number;
  /** Bars narrower than this % drop the count line (auto mode, default 25). */
  compactLabelThreshold?: number;
  /** Overlay drop-off labels auto-hide above this stage count (default 8). */
  dropOffLabelMaxStages?: number;
  /** Auto-shrink inside label font on narrow bars (default true, auto mode). */
  labelAutoScale?: boolean;
  /**
   * Outside labels: "stacked" (default) staggers them vertically with bent
   * leader lines (moveOverlap shiftY) so they never pile up; "aligned"
   * keeps each label level with its stage and merely hides overlaps.
   */
  outsideLabelArrangement?: "stacked" | "aligned";
  showValues?: boolean;
  showPercentages?: boolean;
  showDropOffIndicators?: boolean;
  /** Explicit per-stage palette (wins over theme.stageColors). */
  colorPalette?: string[];
  /** "ramp" derives the palette from one baseColor (light → base → dark). */
  colorMode?: "palette" | "ramp";
  /** Base color for colorMode "ramp" (any hex, e.g. "#3B82F6"). */
  baseColor?: string;
  /** Which funnel end gets the light tint (default "light-to-dark"). */
  rampDirection?: "light-to-dark" | "dark-to-light";
  /** Per-bar linear gradient (stage color → lighter variant). */
  fillGradient?: boolean;
  selectedStageEmphasis?: boolean;
}

export interface TrendChartConfig {
  smooth?: boolean;
  showSymbols?: boolean;
  showArea?: boolean;
  showDataLabels?: boolean;
  yAxisMin?: number;
  yAxisMax?: number;
  connectNulls?: boolean;
  lineWidth?: number;
  symbolSize?: number;
  legendPosition?: "top" | "bottom";
  showZoom?: boolean;
  colorPalette?: string[];
}

export interface InsightsConfig {
  /** D5 defaults: improving >= +1.0 pp, declining <= −1.0 pp. */
  thresholds?: {
    improvingPp?: number;
    decliningPp?: number;
  };
  anomalySigma?: number;
}

export interface AnimationConfig {
  enabled?: boolean;
  durationMs?: number;
  /** Respect prefers-reduced-motion (default true). */
  respectReducedMotion?: boolean;
}

export interface FunnelAnalysisTheme {
  mode?: "light" | "dark";
  background?: string;
  textColor?: string;
  mutedTextColor?: string;
  gridColor?: string;
  stageColors?: string[];
  transitionColors?: string[];
  borderRadius?: number;
  fontFamily?: string;
}

// ---------------------------------------------------------------------------
// Filter & selection API (controlled / uncontrolled)
// ---------------------------------------------------------------------------

export interface FunnelAnalysisFilters {
  dateRange?: DateRange;
  segment?: string | null;
  granularity?: Granularity;
}

export interface FunnelAnalysisSelection {
  selectedStageId?: string | null;
  selectedTransitionId?: string | null;
  visibleSeriesIds?: string[];
}

// ---------------------------------------------------------------------------
// Event API — application-level events only, never raw ECharts events.
// ---------------------------------------------------------------------------

export type FunnelAnalysisEvent =
  | { type: "stage.select"; stageId: string | null }
  | { type: "transition.select"; transitionId: string | null }
  | { type: "series.visibility.change"; seriesIds: string[] }
  | { type: "filter.change"; filters: FunnelAnalysisFilters }
  | { type: "trend.point.click"; point: FunnelTrendPoint }
  | { type: "selection.reset" };

// ---------------------------------------------------------------------------
// Insight engine
// ---------------------------------------------------------------------------

export type FunnelInsightType =
  | "highest_dropoff"
  | "improving"
  | "declining"
  | "stable"
  | "overall_conversion"
  | "anomaly";

export type FunnelInsightSeverity = "positive" | "neutral" | "warning" | "critical";

export interface FunnelInsight {
  id: string;
  type: FunnelInsightType;
  severity: FunnelInsightSeverity;
  title: string;
  description: string;
  stageId?: string;
  transitionId?: string;
  value?: number;
  /** Change in percentage points (pp), never relative %. */
  change?: number;
  comparisonPeriod?: string;
}

// ---------------------------------------------------------------------------
// Main component props
// ---------------------------------------------------------------------------

export interface FunnelAnalysisProps {
  data: FunnelAnalysisData;
  config?: FunnelAnalysisConfig;
  filters?: FunnelAnalysisFilters;
  selection?: FunnelAnalysisSelection;
  loading?: boolean;
  error?: Error | null;
  onFilterChange?: (filters: FunnelAnalysisFilters) => void;
  onStageSelect?: (stage: FunnelStage | null) => void;
  onTransitionSelect?: (transition: FunnelTransitionViewModel | null) => void;
  onSeriesVisibilityChange?: (seriesIds: string[]) => void;
  onDataPointClick?: (point: FunnelTrendPoint) => void;
  onEvent?: (event: FunnelAnalysisEvent) => void;
  onReset?: () => void;
  className?: string;
  style?: CSSProperties;
}
