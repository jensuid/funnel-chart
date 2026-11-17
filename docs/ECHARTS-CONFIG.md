# ECHARTS-CONFIG — opsi chart & tema

## Setup (`echartsSetup.ts`)

Import tree-shaken (`echarts/core` + `SVGRenderer` + funnel/line/legend/tooltip/grid),
init dengan `{ renderer: "svg" }`. SVG dipilih demi ketajaman teks dan a11y.

## Funnel Overview (`createFunnelOption.ts`)

- Satu series `type: "funnel"`, `id: "funnel-stages"`, `sort: "descending"`,
  `gap`, `minSize`/`maxSize` dari config. **Lebar bar = volume**, bukan rate.
- Label (D3): dari view model datum — `name`, count terformat, cumulative % —
  via `formatter`, bukan template `{b}\n{c}`.
- **Penempatan label** — `labelStrategy`:
  - `"auto"` (default): bar yang lebarnya < `labelOutsideThreshold`% (default 15)
    dari bar terlebar otomatis pindah labelnya ke LUAR (terbaca di background);
    sisanya tetap di dalam. Warna label dalam kontras-aware
    (`readableTextColor`) — teks gelap di atas fill terang (mis. ujung light
    dari monochrome ramp), putih di atas fill gelap.
  - `"fixed"`: semua label mengikuti `labelPosition` apa adanya.
  - Label `outside` selalu memakai `tokens.textColor` (bukan putih — bug lama:
    label putih tak terlihat di background putih).
  - Anti-tabrakan: saat label stage pindah ke luar, label drop-off overlay di
    stage yang sama dikosongkan (info tetap ada di tooltip & data table).
- Drop-off indicators (D3): series funnel kedua **transparan** dengan layout
  identik (sort/orient/min/max/gap) hanya untuk label luar.
- `itemStyle`: fill = warna stage brand; `borderColor = accessibleStroke(...)`
  (WCAG 1.4.11, 3:1 terhadap background terang), `borderWidth: 1`;
  seleksi/hover menimpa dengan border 2px warna teks.

## Conversion Rate Trend (`createTrendOption.ts`)

- Satu series `type: "line"` **per transition, keyed by ID** (bukan posisi array).
- Warna = warna stage tujuan (D2, `transitionColor`).
- Y-axis 0–100%; `connectNulls: false` — gap data = `null`, bukan 0.
- Series terseleksi/hover: width +1; series lain **subdued** (`opacity 0.25`),
  tidak dihapus.
- `lineStyle.color = accessibleStroke(...)` agar garis memenuhi 3:1.

## Tooltip (`tooltipFormatter.ts`)

Axis tooltip trend; hanya series yang terlihat; nilai `null` dirender `—`.

## Tema (`chartTheme.ts`)

- Palette brand terkunci (DATA-CONTRACT): Blue `#3B82F6`, Cyan `#06B6D4`,
  Teal `#14B8A6`, Green `#22C55E`, Amber `#F59E0B`; diulang untuk funnel > 5 stage;
  `theme.stageColors` menimpa.
- Token light/dark: `textColor` 4.5:1 di atas `background` (WCAG 1.4.3).
- `accessibleStroke(index, theme, background, palette)`: menggelapkan warna bertahap
  (blend ke hitam, langkah 0.1) sampai kontras ≥ 3:1 — fill brand tidak diubah.

## Kustomisasi warna (`resolveStagePalette`)

Palette efektif stage disederhanakan menjadi satu sumber kebenaran yang dipakai
funnel fill, trend line, dan transition color (D2 tetap konsisten). Prioritas:

1. **Ramp monokrom** — `funnel.colorMode: "ramp"` + `funnel.baseColor`:
   satu warna dasar disapu light tint → base → dark shade sepanjang jumlah
   stage (`monochromeRamp`). Cocok untuk funnel karena gradasi menegaskan
   progresi; bekerja untuk jumlah stage berapa pun.
2. **`funnel.colorPalette`** — palette eksplisit per stage (dahulu dideklarasikan
   tapi tidak dikonsumsi; kini aktif).
3. **`theme.stageColors`** — palette level tema.
4. **Default brand palette**.

Trend chart punya override sendiri (`trend.colorPalette`) yang menang atas
palette efektif funnel jika di-set eksplisit.

**Gradient fill per bar** — `funnel.fillGradient: true` mengisi tiap bar dengan
gradient linear (warna stage → varian lebih terang 45%), arah mengikuti
`orientation`. Stroke a11y tetap dihitung dari warna dasar stage, jadi WCAG
1.4.11 tetap terpenuhi untuk mode palette maupun ramp.
