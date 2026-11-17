import type {
  FunnelAnalysisData,
  FunnelPeriodData,
  FunnelStageObservation,
  FunnelTrendPoint,
  FunnelTransitionViewModel,
  Granularity,
} from "../types/funnelAnalysis.types";

/**
 * Period aggregation.
 *
 * Rule (DATA-CONTRACT §4): aggregate conversion is Σ N(next) / Σ N(prev) × 100
 * — summed counts, NEVER the average of per-period rates. Valid only when
 * cohort/attribution semantics are consistent (caller's responsibility, MVP).
 */

const WEEK_RE = /^(\d{4})-W(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** ISO week label ('2026-W41') for a calendar date. */
export function isoWeekLabel(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay() || 7; // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek); // nearest Thursday
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const weekStr = String(week).padStart(2, "0");
  return `${date.getUTCFullYear()}-W${weekStr}`;
}

/** Monday (UTC) of an ISO week label, as YYYY-MM-DD. */
export function isoWeekToDate(weekLabel: string): string {
  const m = WEEK_RE.exec(weekLabel);
  if (!m) return weekLabel;
  const year = Number(m[1]);
  const week = Number(m[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

export type ParsedPeriod =
  | { kind: "date"; year: number; month: number; day: number; raw: string }
  | { kind: "week"; year: number; week: number; raw: string }
  | { kind: "month"; year: number; month: number; raw: string }
  | { kind: "unknown"; raw: string };

export function parsePeriod(period: string): ParsedPeriod {
  const d = DATE_RE.exec(period);
  if (d) {
    return {
      kind: "date",
      year: Number(d[1]),
      month: Number(d[2]),
      day: Number(d[3]),
      raw: period,
    };
  }
  const w = WEEK_RE.exec(period);
  if (w) return { kind: "week", year: Number(w[1]), week: Number(w[2]), raw: period };
  const m = MONTH_RE.exec(period);
  if (m) return { kind: "month", year: Number(m[1]), month: Number(m[2]), raw: period };
  return { kind: "unknown", raw: period };
}

/**
 * Map a period to its bucket key for the given granularity.
 * daily → identity; weekly → ISO week (dates) / identity (week labels) /
 * month labels stay atomic; monthly → YYYY-MM.
 */
export function bucketKey(period: string, granularity: Granularity): string {
  if (granularity === "daily") return period;
  const parsed = parsePeriod(period);
  if (granularity === "weekly") {
    if (parsed.kind === "date") {
      return isoWeekLabel(parsed.year, parsed.month, parsed.day);
    }
    return period; // week labels & months stay atomic
  }
  // monthly
  if (parsed.kind === "date") return `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
  if (parsed.kind === "week") return isoWeekToDate(period).slice(0, 7);
  if (parsed.kind === "month") return period;
  return period;
}

/** Sort key so buckets come out in chronological order. */
function bucketSortKey(key: string): string {
  const parsed = parsePeriod(key);
  if (parsed.kind === "week") return isoWeekToDate(key);
  return key;
}

export interface AggregatedPeriod {
  bucket: string;
  observations: FunnelStageObservation[];
  /** Periods merged into this bucket (source labels). */
  sourcePeriods: string[];
  /** Stage IDs missing from every source period in this bucket. */
  missingStageIds: string[];
}

/**
 * Group period observations into buckets and SUM counts per stage.
 * Duplicate stage observations within one source period keep the first value.
 */
export function aggregatePeriods(
  periods: FunnelPeriodData[],
  stageIds: string[],
  granularity: Granularity,
): AggregatedPeriod[] {
  const buckets = new Map<
    string,
    { sums: Map<string, number>; missing: Set<string>; sources: string[] }
  >();

  for (const period of periods) {
    const key = bucketKey(period.period, granularity);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { sums: new Map(), missing: new Set(stageIds), sources: [] };
      buckets.set(key, bucket);
    }
    bucket.sources.push(period.period);

    const seenInPeriod = new Set<string>(); // dedupe within this source period only
    for (const obs of period.stages) {
      if (seenInPeriod.has(obs.stageId)) continue;
      seenInPeriod.add(obs.stageId);
      bucket.missing.delete(obs.stageId);
      bucket.sums.set(obs.stageId, (bucket.sums.get(obs.stageId) ?? 0) + obs.count);
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => bucketSortKey(a).localeCompare(bucketSortKey(b)))
    .map(([bucket, value]) => ({
      bucket,
      observations: stageIds
        .filter((id) => value.sums.has(id))
        .map((id) => ({ stageId: id, count: value.sums.get(id)! })),
      sourcePeriods: value.sources,
      missingStageIds: [...value.missing],
    }));
}

/**
 * Σ-ratio aggregation for one transition across buckets:
 * CR = Σ N(to) / Σ N(from) × 100. null when sums are missing or denominator 0.
 */
export function aggregateTransitionRate(
  fromSums: { total: number | undefined; present: boolean },
  toSums: { total: number | undefined; present: boolean },
): number | null {
  if (!fromSums.present || !toSums.present) return null;
  if (fromSums.total === undefined || toSums.total === undefined) return null;
  if (fromSums.total === 0) return null;
  return (toSums.total / fromSums.total) * 100;
}

/** Build trend points: one per (bucket × transition). Gaps are null. */
export function buildTrend(
  data: FunnelAnalysisData,
  transitions: FunnelTransitionViewModel[],
  granularity: Granularity,
): { trend: FunnelTrendPoint[]; missingPeriods: string[] } {
  const stageIds = [...data.stages].sort((a, b) => a.order - b.order).map((s) => s.id);
  const aggregated = aggregatePeriods(data.periods, stageIds, granularity);
  const missingPeriods: string[] = [];

  const trend: FunnelTrendPoint[] = [];
  for (const bucket of aggregated) {
    if (bucket.missingStageIds.length > 0) {
      missingPeriods.push(bucket.bucket);
    }
    const countByStage = new Map<string, number>();
    for (const obs of bucket.observations) countByStage.set(obs.stageId, obs.count);

    for (const transition of transitions) {
      const from = countByStage.get(transition.fromStageId);
      const to = countByStage.get(transition.toStageId);
      const rate = aggregateTransitionRate(
        { total: from, present: from !== undefined },
        { total: to, present: to !== undefined },
      );
      trend.push({ period: bucket.bucket, transitionId: transition.id, conversionRate: rate });
    }
  }
  return { trend, missingPeriods };
}
