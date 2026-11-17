/**
 * Canonical data contract — INPUT types.
 *
 * Rule (DATA-CONTRACT.md D1): consumers provide only stage definitions and
 * period observations. All metrics (conversion, drop-off) are DERIVED.
 * Never accept pre-computed rates as input.
 */

export interface FunnelStage {
  id: string;
  label: string;
  /** 1-based, unique; determines funnel order. */
  order: number;
  description?: string;
}

export interface FunnelStageObservation {
  /** Must reference a `FunnelStage.id`. */
  stageId: string;
  /** >= 0. One counting unit per dataset (see FunnelMetadata.unit). */
  count: number;
  uniqueUsers?: number;
}

export interface FunnelPeriodData {
  /** ISO-ish: '2026-10-01' | '2026-W41' | '2026-10'. */
  period: string;
  stages: FunnelStageObservation[];
}

export interface FunnelSegment {
  id: string;
  label: string;
}

export interface FunnelMetadata {
  currency?: string;
  timezone?: string;
  source?: string;
  unit?: "users" | "sessions" | "events" | "leads";
  attributionWindow?: string;
}

export interface FunnelAnalysisData {
  id: string;
  name: string;
  stages: FunnelStage[];
  periods: FunnelPeriodData[];
  /**
   * D4: MVP supports `preFiltered` segment mode only. Declared here for API
   * stability; the component warns if a segment filter is not supported by
   * the dataset.
   */
  segments?: FunnelSegment[];
  metadata?: FunnelMetadata;
}

// ---------------------------------------------------------------------------
// View models — internal, derived. Never an input.
// ---------------------------------------------------------------------------

export interface FunnelStageViewModel {
  stage: FunnelStage;
  count: number;
  /** N(i) / N(0) × 100. null when N(0) = 0 or data missing. */
  cumulativeConversion: number | null;
  /** N(i) / N(i-1) × 100. null for the first stage or zero denominator. */
  stageToStageConversion: number | null;
  /** 100 − stageToStageConversion. null when conversion is null. */
  dropOff: number | null;
}

export interface FunnelTransitionViewModel {
  /** `${fromStageId}->${toStageId}` */
  id: string;
  fromStageId: string;
  toStageId: string;
  /** null = unavailable (zero denominator / missing data) — never NaN/Infinity. */
  conversionRate: number | null;
  dropOffRate: number | null;
}

export interface FunnelTrendPoint {
  period: string;
  transitionId: string;
  /** null → data gap (rendered as missing, connectNulls: false), NOT zero. */
  conversionRate: number | null;
}

export interface FunnelAnalysisViewModel {
  overallConversion: number | null;
  stages: FunnelStageViewModel[];
  transitions: FunnelTransitionViewModel[];
  /** One point per (period × transition). */
  trend: FunnelTrendPoint[];
}

// ---------------------------------------------------------------------------
// Shared interaction state
// ---------------------------------------------------------------------------

export type Granularity = "daily" | "weekly" | "monthly";

export interface DateRange {
  from: string;
  to: string;
}

export interface FunnelAnalysisState {
  dateRange: DateRange | null;
  segment: string | null;
  granularity: Granularity;
  selectedStageId: string | null;
  selectedTransitionId: string | null;
  visibleSeriesIds: string[];
  hoveredStageId: string | null;
  hoveredTransitionId: string | null;
}
