# IMPLEMENTATION-PLAN.md — FunnelAnalysis

> Rencana implementasi 8 work package (WP) sesuai Spec #3, dengan urutan yang menyerang risiko tinggi lebih awal. Setiap WP punya **verification gate** — WP berikutnya tidak dimulai sebelum gate lulus.

## Keputusan teknis (locked)

| Area | Keputusan |
|---|---|
| Build | Vite 6 + React 19 + TypeScript 5.7 (strict, `noUncheckedIndexedAccess`) |
| Chart engine | `echarts` v6, **wrapper controlled sendiri** (bukan `echarts-for-react`) — kontrol penuh lifecycle listener & `setOption` |
| State | `useReducer` + interaction coordinator |
| Test | Vitest + React Testing Library (jsdom) |
| Path alias | `@/*` → `src/*` |
| Metrik | Derived pure functions (lihat DATA-CONTRACT.md D1) |

## Struktur folder target

```
src/
  funnel-analysis/
    components/   FunnelAnalysis.tsx, FunnelOverview.tsx, ConversionTrend.tsx,
                  KeyInsights.tsx, TrendSummary.tsx, EChartsWrapper.tsx
    charts/       createFunnelOption.ts, createTrendOption.ts,
                  tooltipFormatter.ts, chartTheme.ts, dropOffIndicators.ts
    state/        funnelAnalysisReducer.ts, interactionCoordinator.ts
    metrics/      calculateFunnelMetrics.ts, aggregateTrendMetrics.ts
    adapters/     normalizeFunnelData.ts
    validation/   validateFunnelData.ts
    insights/     generateInsights.ts
    types/        funnelAnalysis.types.ts
tests/
  fixtures/       standard-funnel.ts, high-dropoff.ts, zero-volume.ts,
                  non-monotonic.ts, incomplete.ts, large.ts
  metrics.test.ts, validation.test.ts, aggregation.test.ts,
  interactions.test.tsx, component.test.tsx
```

## Work packages

### Fase 0 — Setup ✅ (selesai)
- [x] package.json, tsconfig (strict), vite.config (alias + vitest), .gitignore
- [x] `pnpm install`
- [x] docs/DATA-CONTRACT.md, docs/IMPLEMENTATION-PLAN.md
- [x] Gate 0: smoke test Vitest hijau + `tsc --noEmit` bersih ✅

### WP-01 — Foundation & Types ✅
- `types/funnelAnalysis.types.ts` (tipe §2–3 DATA-CONTRACT)
- Public API types: `FunnelAnalysisProps`, `FunnelAnalysisConfig`, `FunnelChartConfig`, `TrendChartConfig`, `FunnelAnalysisTheme`, `FunnelAnalysisEvent`, `FunnelInsight`, `FunnelValidationResult`
- chartTheme.ts (palet D2, token spacing/radius)
- **Gate 1:** `tsc --noEmit` bersih; tipe diekspor dari barrel `index.ts`

### WP-02 — Metric Engine (logika murni, tanpa UI) ✅
- `calculateFunnelMetrics.ts`: cumulative, stage-to-stage, drop-off, overall; null untuk zero denominator
- `aggregateTrendMetrics.ts`: agregasi Σ-rasio (bukan rata-rata rate), mapping granularity
- `validateFunnelData.ts`: urutan structural → referential → numerical → analytical; policy non-monotonic
- `normalizeFunnelData.ts`: sort by order, dedupe, normalisasi periode
- 6 fixtures + unit tests vs golden dataset
- **Gate 2:** semua unit test hijau, termasuk expected Week 1/Week 2 di DATA-CONTRACT §7

### WP-03 — Funnel Visualization ✅
- `EChartsWrapper.tsx`: instance persisten, `setOption` terkontrol, ResizeObserver, cleanup listener di unmount
- `createFunnelOption.ts`: funnel series dari `FunnelStageViewModel[]`
- Label kustom (nama + count + cumulative %) via view model — **bukan** formatter template
- `dropOffIndicators.ts`: drop-off & stage-to-stage % di luar funnel (custom graphic) — **risiko tertinggi, prototype dulu di sini**
- Emphasis stage terpilih; tooltip item
- **Gate 3:** chart render benar di jsdom (option structure) + smoke visual manual via `pnpm dev`

### WP-04 — Conversion Trend ✅
- `createTrendOption.ts` + `buildTransitionSeries`: series by transition ID (bukan posisi array), warna = stage tujuan (D2)
- Y-axis 0–100%, `connectNulls: false`, gap = null; tooltip axis dengan hanya series visible
- Legend scroll; optional dataZoom (nonaktif default)
- **Gate 4:** option structure test + legend toggle test

### WP-05 — Interaction Coordinator ✅
- `funnelAnalysisReducer.ts`: state sesuai spec (dateRange, segment, granularity, selectedStageId, selectedTransitionId, visibleSeriesIds, hoveredStageId)
- `interactionCoordinator.ts`: precedence — filter > selection > hover; visibility ≠ selection; hover tidak mengubah selection
- Wiring event ECharts (click/mouseover/mouseout/legendselectchanged) → actions; satu kali subscribe, bukan per update
- Seleksi dua arah: stage ↔ transitions in/out; transition ↔ kedua stage
- Controlled/uncontrolled filters & selection
- **Gate 5:** 8 integration test scenarios hijau (termasuk reset, unmount tanpa listener tersisa)

### WP-06 — Insights Engine
- `generateInsights.ts`: highest drop-off, improving/declining/stable (threshold D5, pp bukan %), overall conversion, anomaly (deviasi > 2σ dari rata-rata transition)
- Output `FunnelInsight[]`; comparison periode ekuivalen
- **Gate 6:** unit test insight terhadap fixture `high-dropoff-funnel`

### WP-07 — Composite Component
- `FunnelAnalysis.tsx`: susun panel, layout default/compact/stacked, responsive 3 breakpoint
- 8 component states: loading, loading-with-data, success, empty, partial, error, invalid, no-match
- `KeyInsights` + `TrendSummary` dari insight engine; config flags menghormati semua `show*`
- **Gate 7:** component tests (props, states, callbacks) hijau

### WP-08 — Quality & Verification
- Visual regression: 10 skenario screenshot (Playwright, ditambahkan belakangan)
- A11y: keyboard nav, fokus terlihat, data table fallback (`showDataTable`) sebagai mekanisme a11y utama chart, kontras WCAG 2.2 AA
- Perf: `large-funnel` fixture; memoization metrics & options
- Dokumentasi: README, COMPONENT-SPEC, INTERACTION-SPEC, ECHARTS-CONFIG, TEST-SPEC
- **Gate 8 (DoD):** semua test lulus, tanpa listener bocor, reusable antar dataset

## Urutan eksekusi & dependency

```
Fase 0 → WP-01 → WP-02 → WP-03 → WP-04 → WP-05 → WP-06+WP-07 (paralel) → WP-08
                     └─────────────── WP-03/WP-04 butuh view model WP-02
```

## Status

| WP | Status |
|---|---|
| Fase 0 | ✅ selesai (Gate 0 lulus) |
| WP-01 | ✅ selesai (Gate 1 lulus: tsc bersih) |
| WP-02 | ✅ selesai (Gate 2 lulus: 39 test hijau, golden dataset cocok) |
| WP-03 | ✅ selesai (Gate 3 lulus: 61 test hijau, tsc bersih) |
| WP-04 | ✅ selesai (Gate 4 lulus: 76 test hijau, tsc bersih) |
| WP-05 | ✅ selesai (Gate 5 lulus: 98 test hijau, tsc bersih) |
| WP-06 | ✅ selesai (Gate 6 lulus: 125 test hijau, tsc bersih) |
| WP-07 | ✅ selesai (Gate 7 lulus: 125 test hijau termasuk 17 component tests, tsc bersih) |
| WP-08 | ✅ selesai (Gate 8 lulus: 134 test hijau termasuk a11y & perf, tsc bersih, docs lengkap, Playwright discaffold) |
