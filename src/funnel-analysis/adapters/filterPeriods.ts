import type { FunnelPeriodData } from "../types/funnelAnalysis.types";
import type { DateRange } from "../types/funnelAnalysis.types";
import { bucketKey, isoWeekToDate } from "../metrics/aggregateTrendMetrics";

/**
 * Date-range filtering. Periods are matched by their bucket START date so
 * week/month labels compare correctly against ISO date ranges:
 * - '2026-10-01' → itself
 * - '2026-W41'   → its Monday
 * - '2026-10'    → first of month
 * Unknown period formats never match a range (fail closed, with the caller
 * free to surface a validation warning).
 */
export function periodStart(period: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return period;
  if (/^\d{4}-W\d{2}$/.test(period)) return isoWeekToDate(period);
  if (/^\d{4}-\d{2}$/.test(period)) return `${period}-01`;
  return null;
}

export function periodInRange(period: string, range: DateRange): boolean {
  const start = periodStart(period);
  if (!start) return false;
  if (range.from && start < range.from) return false;
  if (range.to) {
    // Inclusive end: a week starting before `to` but spanning it still counts.
    const end = periodEnd(period);
    if (end && end > range.to) return false;
    if (!end && start > range.to) return false;
  }
  return true;
}

function periodEnd(period: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return period;
  if (/^\d{4}-W\d{2}$/.test(period)) {
    const start = isoWeekToDate(period);
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + 6);
    return d.toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number) as [number, number];
    const d = new Date(Date.UTC(y, m, 0)); // day 0 of next month = last day
    return d.toISOString().slice(0, 10);
  }
  return null;
}

export function filterPeriodsByRange(
  periods: FunnelPeriodData[],
  range: DateRange | null,
): FunnelPeriodData[] {
  if (!range) return periods;
  return periods.filter((p) => periodInRange(p.period, range));
}

/** Re-exported for convenience: bucket key respects granularity. */
export { bucketKey };
