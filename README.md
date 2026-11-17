# funnel-chart

Komponen **FunnelAnalysis** — React + TypeScript + Apache ECharts (SVG renderer).
Tiga panel dalam satu konteks data dan satu interaction state:

1. **Funnel Overview** — lebar bar = volume, label name + count + cumulative %
2. **Key Insights** — rule-based insight engine (highest drop-off, improving/declining/stable, overall conversion, anomaly >2σ)
3. **Conversion Rate Trend** — satu series per transition, warna = warna stage tujuan (D2)

## Prinsip desain

- **ECharts adalah rendering engine, bukan source of truth.** Semua metrik dihitung di luar chart dan diinjeksi sebagai view model (D1).
- **Pipeline:** validate → normalize → filter (date range) → aggregate (Σ-ratio) → view model → option factory → render.
- **A11y:** data table (`showDataTable`) adalah mekanisme a11y utama chart; bar/line diberi stroke yang memenuhi WCAG 1.4.11 (3:1) tanpa mengubah palette brand.
- **State 8 kondisi:** loading, loading-with-data, success, empty, partial, error, invalid, no-match.

## Struktur

```
src/funnel-analysis/
  components/   FunnelAnalysis (composite), FunnelOverview, ConversionTrend,
                KeyInsights, TrendSummary, EChartsWrapper
  charts/       echartsSetup, createFunnelOption, createTrendOption,
                dropOffIndicators, tooltipFormatter, chartTheme
  state/        funnelAnalysisReducer, interactionCoordinator
  metrics/      calculateFunnelMetrics, aggregateTrendMetrics
  adapters/     normalizeFunnelData, filterPeriods
  validation/   validateFunnelData
  insights/     generateInsights
  types/        funnelAnalysis.types, api.types
```

## Menjalankan

```bash
pnpm install
pnpm test          # Vitest (unit + integration + a11y + perf)
pnpm typecheck     # tsc --noEmit
pnpm dev           # dev server untuk demo / visual regression
```

Visual regression (opsional, butuh Playwright):

```bash
pnpm add -D @playwright/test && pnpm exec playwright install chromium
pnpm exec playwright test
```

## Publikasi package (disiapkan, belum aktif)

Package sudah siap publish: build lib (`pnpm build:lib`), deklarasi tipe,
`exports` map, `LICENSE`, dan workflow CI `.github/workflows/ci.yml` dengan job
`publish` ter-gate tag `v*`. Saat ini `"private": true` — publish sengaja
nonaktif. Untuk mengaktifkan:

1. Ganti `repository.url` di `package.json` ke repo asli.
2. Set `"private": false`.
3. Set secret `NPM_TOKEN` di GitHub repo settings.
4. Tag & push: `git tag v0.1.0 && git push origin v0.1.0` — CI menjalankan
   verify + publish (butuh approval environment `npm-publish`).

`prepublishOnly` otomatis menjalankan test + typecheck + build lib sebelum
setiap `pnpm publish`.

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [docs/DATA-CONTRACT.md](docs/DATA-CONTRACT.md) | Kontrak data, keputusan D1–D5, golden dataset |
| [docs/COMPONENT-SPEC.md](docs/COMPONENT-SPEC.md) | API publik, props, 8 state komponen |
| [docs/INTERACTION-SPEC.md](docs/INTERACTION-SPEC.md) | Seleksi, hover, visibility, filter, mutual exclusivity |
| [docs/ECHARTS-CONFIG.md](docs/ECHARTS-CONFIG.md) | Opsi ECharts, tema, stroke a11y |
| [docs/TEST-SPEC.md](docs/TEST-SPEC.md) | Strategi test, 10 skenario visual regression |
| [docs/PUBLISHING.md](docs/PUBLISHING.md) | Panduan publish ke npm (langkah, rollback, troubleshooting) |
| [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md) | WP-01…WP-08 dan status gate |
