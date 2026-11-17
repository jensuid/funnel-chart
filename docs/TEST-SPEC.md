# TEST-SPEC — strategi & cakupan

Stack: **Vitest + React Testing Library (jsdom)**, renderer SVG, import ECharts
tree-shaken. `tests/setup.ts` menyediakan stub `ResizeObserver`.

## Suite

| File | Cakupan |
|---|---|
| `smoke.test.ts` | Sanitas import & render |
| `metrics.test.ts` | Metrik kumulatif/stage-to-stage/drop-off/overall; null untuk denominator 0 |
| `validation.test.ts` | 10 kode validasi, urutan structural→referential→numerical→analytical, policy non-monotonic |
| `aggregation.test.ts` | Parsing period (date/ISO-week/month), Σ-ratio, bucketing (`2026-W01` → bulan 2025-12 & 2026-01) |
| `funnelOption.test.ts` | Opsi funnel, label view model (D3), seleksi vs visibility, stroke a11y |
| `trendOption.test.ts` | Series per ID, warna stage tujuan (D2), gap null, subdued-not-removed |
| `echartsWrapper.test.ts` | Lifecycle wrapper, `setOption` notMerge, listener sekali, dispose, event via `instance.trigger` |
| `interactions.test.ts` | 11 skenario integrasi reducer + koordinator (mutual exclusivity, hover, visibility, filter, reset) |
| `insights.test.ts` | 5 aturan insight; anomali >2σ (6 bucket: 5×70% + 1×20% → √5 ≈ 2.24σ) |
| `component.test.tsx` | 17 test: 8 state, config flags, callbacks, data table |
| `accessibility.test.tsx` | Kontras WCAG (teks 4.5:1, stroke 3:1), landmark, `role=alert/status`, fallback tabel |
| `perf.test.tsx` | Fixture `large` (12 stage × 104 periode): render dalam budget, tanpa NaN, tabel 12 baris, trend 104 titik |

Total saat Gate 8: **134 test hijau**, `tsc --noEmit` bersih.

## Visual regression (Playwright, opsional)

`e2e/visual-regression.spec.ts` + `playwright.config.ts` (system Chrome via
`channel: "chrome"` — Playwright ≥1.53 tidak menyediakan build chromium untuk
macOS 13; dev server otomatis, toleransi `maxDiffPixelRatio: 0.01`). Jalankan:

```bash
pnpm exec playwright test                          # bandingkan snapshot
pnpm exec playwright test --update-snapshots       # perbarui golden
```

### 10 skenario

1. `01-success-default` — funnel standar, kedua panel + summary
2. `02-stage-selected` — satu stage terseleksi (border 2px + highlight tetangga)
3. `03-transition-selected` — transition terseleksi, kedua stage endpoint ter-highlight
4. `04-legend-filtered` — satu series dimatikan via legend (subdued, bukan hilang)
5. `05-hover-tooltip` — hover stage, tooltip tampil
6. `06-date-range-filtered` — filter tanggal mempersempit trend
7. `07-partial-data` — banner partial data + gap pada trend
8. `08-zero-volume` — metrics `—`, tanpa NaN
9. `09-invalid-data` — state invalid dengan daftar kode error
10. `10-dark-compact` — tema gelap + layout compact

## DoD (Gate 8)

- Semua test lulus; tanpa listener bocor setelah unmount.
- Komponen reusable antar dataset (fixtures golden, large, incomplete, zero, non-monotonic, high-dropoff).
- Perf: pipeline memoized; render large fixture dalam budget test.
