/**
 * Custom HTML tooltip formatter for the trend chart.
 * Spec §3: show ALL visible series for the same period; never show series
 * disabled by the legend. Null rates render as "—" (gap), never 0%.
 */

export interface TooltipSeriesMeta {
  id: string;
  /** Display name, e.g. "Visitors → Product Views". */
  name: string;
  color: string;
}

export interface TrendTooltipParams {
  seriesId?: string;
  seriesName?: string;
  value?: number | null;
  axisValue?: string | number;
}

export interface CreateTrendTooltipFormatterInput {
  seriesMeta: TooltipSeriesMeta[];
  visibleSeriesIds: string[];
}

export function formatTrendPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
}

export function createTrendTooltipFormatter(
  input: CreateTrendTooltipFormatterInput,
): (params: unknown) => string {
  const { seriesMeta, visibleSeriesIds } = input;
  const visible = new Set(visibleSeriesIds);

  return (rawParams) => {
    const params = (Array.isArray(rawParams) ? rawParams : [rawParams]) as TrendTooltipParams[];
    if (params.length === 0) return "";

    const period = String(params[0]?.axisValue ?? "");
    const metaById = new Map(seriesMeta.map((m) => [m.id, m]));

    // Display order follows seriesMeta (transition order), not event order.
    const rows: string[] = [];
    for (const meta of seriesMeta) {
      if (!visible.has(meta.id)) continue;
      const point = params.find((p) => p.seriesId === meta.id);
      if (!point) continue;
      const value = typeof point.value === "number" ? point.value : null;
      rows.push(
        `<div style="display:flex;align-items:center;gap:6px;">` +
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${meta.color};"></span>` +
          `<span>${meta.name}</span>` +
          `<span style="margin-left:auto;font-weight:600;padding-left:12px;">${formatTrendPercent(value)}</span>` +
          `</div>`,
      );
    }

    const html =
      `<div style="font-family:inherit;">` +
      `<div style="font-weight:600;margin-bottom:4px;">${period}</div>` +
      rows.join("") +
      `</div>`;
    return html;
  };
}
