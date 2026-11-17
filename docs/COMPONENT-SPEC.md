# COMPONENT-SPEC — FunnelAnalysis

## Import

```ts
import { FunnelAnalysis } from "./funnel-analysis";
```

## Props (`FunnelAnalysisProps`, `types/api.types.ts`)

| Prop | Tipe | Default | Keterangan |
|---|---|---|---|
| `data` | `FunnelAnalysisData` | — | Stage definitions + period observations (D1: transisi TIDAK ada di input) |
| `config` | `FunnelAnalysisConfig?` | — | Flag `show*`, tema, layout, config per panel |
| `filters` | `FunnelAnalysisFilters?` | — | `dateRange {from,to}`, `granularity` |
| `selection` | `FunnelSelection?` | — | Controlled selection (stage/transition) |
| `loading` | `boolean` | `false` | Badge "Updating…" + `aria-live=polite`, insight panel `aria-busy` |
| `error` | `Error?` | `null` | Render error state |
| `onFilterChange` | callback? | — | Dipanggil saat filter berubah |
| `onStageSelect` | `(ids: string[]) => void` | — | Stage dipilih/dibatalkan |
| `onTransitionSelect` | `(id: string?) => void` | — | Transition dipilih |
| `onSeriesVisibilityChange` | `(ids: string[]) => void` | — | Hasil legend selection |
| `onEvent` | `(e: FunnelAnalysisEvent) => void` | — | Event terjemahan ECharts |
| `onReset` | `() => void` | — | Reset interaksi |
| `className`, `style` | — | — | Diteruskan ke root div |

## Config flags

`showHeader`, `showStageLabels`, `showCumulativeConversion`, `showDropOff`,
`showLegend`, `showDataTable`, `showTrendSummary`, `showInsights`,
`layout: "default" | "compact" | "stacked"`, `theme`, `funnel`, `trend`,
`insights`, `animation`, `defaultDateRange`, `defaultGranularity`.
Semua flag boolean dihormati; default `true` kecuali `showDataTable` (`false`).

## 8 state komponen

| State | Trigger | Render |
|---|---|---|
| loading | `loading && !data` | skeleton + `aria-busy` |
| loading-with-data | `loading && data` | panel + badge "Updating…" |
| success | validasi lulus, bucket ≥ 1 | grid 3 panel (+ optional table) |
| empty | `periods.length === 0` | "No data yet" |
| no-match | date range mengosongkan bucket | "No matching data" |
| partial | `missingPeriods.length > 0` | banner `role=status` + panel |
| error | `error` prop | `role=alert` "Something went wrong" |
| invalid | validasi gagal (error issues) | `role=alert` daftar `CODE: message` |

## A11y

- Landmark: `Funnel overview`, `Key insights`, `Conversion rate trend`, `Trend summary` (semua `aria-label`).
- **Data table fallback** (`showDataTable`) = mekanisme a11y utama chart: kolom Stage, Volume, Cumulative, Stage conversion, Drop-off; `null` dirender `—`, tidak pernah `NaN`.
- Kontras: teks 4.5:1 (WCAG 1.4.3); grafis memakai stroke 3:1 (WCAG 1.4.11) — lihat ECHARTS-CONFIG.
