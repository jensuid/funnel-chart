# DATA-CONTRACT.md — FunnelAnalysis

> Dokumen ini mengunci keputusan data yang sebelumnya tidak konsisten antar dokumen spesifikasi di `references/`.

## 1. Keputusan yang dikunci (resolution log)

| # | Masalah | Keputusan |
|---|---------|-----------|
| D1 | Spec #1 menyimpan `conversionRate`/`dropOffRate` di `FunnelTransition`; Spec #3 menghapusnya | **Model Spec #3 dipakai.** Semua metrik *derived* dari stage counts. `FunnelTransition` tidak ada di input data — hanya sebagai *view model* internal/output. |
| D2 | Warna stage (Blue/Cyan/Teal/Green/Amber) ≠ warna series transition (Blue/Cyan/Green/Amber, tanpa Teal) | Transition `i→i+1` memakai warna **stage tujuan** (`toStageId`). Warna stage = warna series terkait. Palet default 5 warna terdefinisi di §6. |
| D3 | Label funnel `{b}\n{c}` di contoh factory tidak memenuhi spec visual (butuh cumulative %) | Label funnel dirender dari **view model** (nama + count + cumulative %), bukan formatter template ECharts. Drop-off indicator dirender sebagai elemen tambahan di luar funnel (custom graphic), bukan fitur native series. |
| D4 | Struktur observasi `dimensionAware` untuk segment belum didefinisikan | **MVP = `preFiltered` saja.** Field `segments?` tetap ada di tipe sebagai deklarasi, tapi komponen menolak filter segment dengan warning jika dataset tidak menyediakannya. |
| D5 | Ambang insight improving/declining belum ada | Default: perubahan ≥ **+1.0 pp** = improving, ≤ **−1.0 pp** = declining, di luar itu = stable. Dapat dioverride via `InsightsConfig.thresholds`. Perbandingan: periode ekuivalen sebelumnya (week→week, month→month). |

## 2. Canonical data model (input)

```ts
// types/funnelAnalysis.types.ts

export interface FunnelStage {
  id: string;
  label: string;
  order: number;          // 1-based, unik, menentukan urutan funnel
  description?: string;
}

export interface FunnelStageObservation {
  stageId: string;        // harus merujuk stages[].id
  count: number;          // >= 0, satu unit pengukuran per dataset
  uniqueUsers?: number;
}

export interface FunnelPeriodData {
  period: string;         // ISO-ish: '2026-W41' | '2026-10' | '2026-10-01'
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
  unit?: 'users' | 'sessions' | 'events' | 'leads';
  attributionWindow?: string;
}

export interface FunnelAnalysisData {
  id: string;
  name: string;
  stages: FunnelStage[];
  periods: FunnelPeriodData[];
  segments?: FunnelSegment[];   // D4: MVP preFiltered — dideklarasikan, belum dikonsumsi
  metadata?: FunnelMetadata;
}
```

## 3. View models (internal, derived — bukan input)

```ts
export interface FunnelStageViewModel {
  stage: FunnelStage;
  count: number;
  cumulativeConversion: number | null;  // N(i)/N(0) × 100, null jika N(0)=0
  stageToStageConversion: number | null; // N(i)/N(i-1) × 100, null jika i=0 atau N(i-1)=0
  dropOff: number | null;                // 100 − stageToStageConversion
}

export interface FunnelTransitionViewModel {
  id: string;                 // `${fromStageId}->${toStageId}`
  fromStageId: string;
  toStageId: string;
  conversionRate: number | null;  // null = unavailable (zero denominator / missing data)
  dropOffRate: number | null;
}

export interface FunnelTrendPoint {
  period: string;
  transitionId: string;
  conversionRate: number | null;  // null → gap, BUKAN 0 (connectNulls: false)
}

export interface FunnelAnalysisViewModel {
  overallConversion: number | null;
  stages: FunnelStageViewModel[];
  transitions: FunnelTransitionViewModel[];
  trend: FunnelTrendPoint[];      // satu titik per (period × visible transition)
}
```

Aturan `null`:
- Denominator 0 atau data missing → `null` (unavailable), tidak pernah `NaN`/`Infinity`/`0%`.
- Missing period → titik trend absen (`null` di series data), bukan nol.

## 4. Agregasi periode

```
CR_aggregate(i) = Σ N(i) / Σ N(i−1) × 100   -- jumlah count, BUKAN rata-rata rate
```

Berlaku hanya jika cohort/attribution konsisten antar periode (lihat §6).

Granularity:
- `daily` → pakai periode apa adanya (asumsi input harian).
- `weekly` / `monthly` → kelompokkan periode input ke bucket; agregasi memakai rumus di atas. Periode input yang tidak bisa dipetakan ke bucket → `MISSING_PERIOD_DATA` warning, gap dipertahankan.

## 5. Validasi

Severity & kode (dari Spec #3, tidak berubah):

| Kode | Severity | Behavior |
|---|---|---|
| `MISSING_STAGE`, `DUPLICATE_STAGE_ID`, `INVALID_STAGE_ORDER`, `UNKNOWN_STAGE_REFERENCE`, `NEGATIVE_COUNT` | error | Dataset ditolak → state *invalid data* |
| `NON_MONOTONIC_FUNNEL` | warning (default, policy `strict\|warning\|allow`) | Data tampil + badge non-standard |
| `ZERO_DENOMINATOR` | info | Metrik = `null`, bukan error |
| `MISSING_PERIOD_DATA` | warning | Gap dipertahankan di trend |
| `INCONSISTENT_COUNTING_UNIT`, `INCONSISTENT_COHORT` | warning (MVP: tidak terdeteksi otomatis, didokumentasikan sebagai tanggung jawab pemanggil) | — |

Structural + numerical selalu strict. Urutan validasi: structural → referential → numerical → analytical.

## 6. Palet warna default (D2)

| Stage order | Warna | Hex |
|---|---|---|
| 1 Visitors | Blue | `#3B82F6` |
| 2 Product Views | Cyan | `#06B6D4` |
| 3 Add to Cart | Teal | `#14B8A6` |
| 4 Checkout | Green | `#22C55E` |
| 5 Purchase | Amber | `#F59E0B` |

Transition `i→i+1` = warna stage `i+1` (tujuan). Untuk funnel > 5 stage, palet diinterpolasi/diulang; `theme.stageColors` mengoverride.

## 7. Golden dataset (test fixture — dari Spec #3, tidak diubah)

`standardFunnelFixture`: 5 stage (visitors, views, cart, checkout, purchase), Week 1 & Week 2.

Expected Week 1: overall 7% · V→V 70% · V→C 50% · C→Co 50% · Co→P 40% · highest drop-off 60% (V→V).
Expected Week 2: overall 10% · V→V 70% · V→C 57.14% · C→Co 50% · Co→P 50%.

Fixture lain: `high-dropoff-funnel`, `zero-volume-funnel`, `non-monotonic-funnel`, `incomplete-funnel`, `large-funnel`.

## 8. Cohort & attribution (batasan MVP)

MVP = **sequential funnel**. Pemanggil menjamin dataset konsisten secara counting unit dan attribution. Komponen TIDAK membuktikan identitas user antar stage dari data agregat. Cohort-based & segment-level analysis = extension pasca-MVP.
