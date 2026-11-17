Kita lanjut ke tahap **Component API & Test Specification**.

Ini merupakan tahap terakhir sebelum spesifikasi dapat dipecah menjadi implementation tasks untuk coding agent.

Fokusnya adalah mendefinisikan kontrak penggunaan komponen: bagaimana developer memasukkan data, mengatur tampilan, menerima event, melakukan customization, dan memastikan hasil perhitungan benar.

Ada satu keputusan arsitektural penting yang saya tambahkan: komponen harus mendukung berbagai jenis funnel, bukan hanya sales funnel. Contohnya marketing funnel, user onboarding, product adoption, lead generation, dan conversion pipeline.

# **1. Public React Component API**

Nama publik komponen: `FunnelAnalysis`

Contoh penggunaan:

```

import { FunnelAnalysis } from '@/components/funnel-analysis';

function AnalyticsDashboard() {
  return (
    <FunnelAnalysis
      data={funnelData}
      config={{
        showInsights: true,
        showDropOff: true,
        showTrendSummary: true,
        defaultGranularity: 'weekly',
      }}
      filters={{
        dateRange: {
          from: '2026-10-01',
          to: '2026-10-31',
        },
        segment: 'all',
      }}
      onStageSelect={(stage) => {
        console.log('Selected stage:', stage);
      }}
      onTransitionSelect={(transition) => {
        console.log('Selected transition:', transition);
      }}
    />
  );
}
```

Komponen memiliki empat kategori API:

1. Data API — input dataset.
    
2. Configuration API — mengatur tampilan dan perilaku.
    
3. Filter API — mengatur periode dan segmentasi.
    
4. Event API — mengirimkan interaksi kepada parent component.
    

## **2. Complete TypeScript API contract**

### **A. Main component props**

```

export interface FunnelAnalysisProps {
  data: FunnelAnalysisData;

  config?: FunnelAnalysisConfig;

  filters?: FunnelAnalysisFilters;

  selection?: FunnelAnalysisSelection;

  loading?: boolean;

  error?: Error | null;

  onFilterChange?: (
    filters: FunnelAnalysisFilters
  ) => void;

  onStageSelect?: (
    stage: FunnelStage | null
  ) => void;

  onTransitionSelect?: (
    transition: FunnelTransition | null
  ) => void;

  onSeriesVisibilityChange?: (
    seriesIds: string[]
  ) => void;

  onDataPointClick?: (
    point: FunnelTrendPoint
  ) => void;

  onReset?: () => void;

  className?: string;

  style?: React.CSSProperties;
}
```

### **B. Configuration API**

```

export interface FunnelAnalysisConfig {
  layout?: 'default' | 'compact' | 'stacked';

  showHeader?: boolean;

  showInsights?: boolean;

  showDropOff?: boolean;

  showTrendSummary?: boolean;

  showStageLabels?: boolean;

  showCumulativeConversion?: boolean;

  showLegend?: boolean;

  showTooltips?: boolean;

  showDataTable?: boolean;

  defaultGranularity?:
    | 'daily'
    | 'weekly'
    | 'monthly';

  defaultDateRange?: DateRange;

  funnel?: FunnelChartConfig;

  trend?: TrendChartConfig;

  insights?: InsightsConfig;

  animation?: AnimationConfig;

  theme?: FunnelAnalysisTheme;
}
```

### **C. Funnel chart customization**

```

export interface FunnelChartConfig {
  orientation?: 'vertical' | 'horizontal';

  sort?: 'descending' | 'ascending' | 'none';

  gap?: number;

  minSize?: number;

  maxSize?: number;

  labelPosition?: 'inside' | 'outside';

  showValues?: boolean;

  showPercentages?: boolean;

  showDropOffIndicators?: boolean;

  colorPalette?: string[];

  selectedStageEmphasis?: boolean;
}
```

### **D. Trend chart customization**

```

export interface TrendChartConfig {
  smooth?: boolean;

  showSymbols?: boolean;

  showArea?: boolean;

  showDataLabels?: boolean;

  yAxisMin?: number;

  yAxisMax?: number;

  connectNulls?: boolean;

  lineWidth?: number;

  symbolSize?: number;

  legendPosition?: 'top' | 'bottom';

  showZoom?: boolean;

  colorPalette?: string[];
}
```

### **E. Theme customization**

```

export interface FunnelAnalysisTheme {
  mode?: 'light' | 'dark';

  background?: string;

  textColor?: string;

  mutedTextColor?: string;

  gridColor?: string;

  stageColors?: string[];

  transitionColors?: string[];

  borderRadius?: number;

  fontFamily?: string;
}
```

**Architecture rule:** Public API harus tetap stabil dan tidak mengekspos internal ECharts options secara langsung sebagai primary configuration API.

Jika advanced ECharts customization diperlukan, sediakan extension API terpisah dengan dokumentasi lifecycle dan kompatibilitas.

# **3. Data API — canonical data contract**

Saya merekomendasikan data model yang memisahkan stage definition dari period observations.

Alasannya: stage merupakan struktur funnel yang relatif tetap, sedangkan volume dan conversion berubah setiap periode.

```

export interface FunnelStage {
  id: string;
  label: string;
  order: number;
  description?: string;
}

export interface FunnelStageObservation {
  stageId: string;
  count: number;
  uniqueUsers?: number;
}

export interface FunnelPeriodData {
  period: string;
  stages: FunnelStageObservation[];
}

export interface FunnelAnalysisData {
  id: string;
  name: string;

  stages: FunnelStage[];

  periods: FunnelPeriodData[];

  metadata?: {
    currency?: string;
    timezone?: string;
    source?: string;
    unit?: 'users' | 'sessions' | 'events' | 'leads';
    attributionWindow?: string;
  };
}
```

Contoh dataset:

```

const funnelData: FunnelAnalysisData = {
  id: 'sales-funnel',
  name: 'Sales Funnel',

  stages: [
    { id: 'visitors', label: 'Visitors', order: 1 },
    { id: 'views', label: 'Product Views', order: 2 },
    { id: 'cart', label: 'Add to Cart', order: 3 },
    { id: 'checkout', label: 'Checkout', order: 4 },
    { id: 'purchase', label: 'Purchase', order: 5 },
  ],

  periods: [
    {
      period: '2026-W41',
      stages: [
        { stageId: 'visitors', count: 20000 },
        { stageId: 'views', count: 13000 },
        { stageId: 'cart', count: 6500 },
        { stageId: 'checkout', count: 3250 },
        { stageId: 'purchase', count: 1300 },
      ],
    },
    {
      period: '2026-W42',
      stages: [
        { stageId: 'visitors', count: 22000 },
        { stageId: 'views', count: 14500 },
        { stageId: 'cart', count: 7600 },
        { stageId: 'checkout', count: 4100 },
        { stageId: 'purchase', count: 1800 },
      ],
    },
  ],

  metadata: {
    unit: 'users',
    timezone: 'Asia/Jakarta',
    attributionWindow: '7 days',
  },
};
```

## **4. Important data semantics**

Ada beberapa aturan yang wajib ditentukan agar komponen tidak menghasilkan analisis yang keliru.

**A. Counting semantics**

Komponen harus mengetahui apakah data merepresentasikan:

- Unique users.
    
- Sessions.
    
- Events.
    
- Leads atau opportunities.
    

Tidak boleh mencampurkan unit yang berbeda dalam satu funnel.

**B. Funnel consistency**

Untuk standard sequential funnel:

\[ N_0 \geq N_1 \geq N_2 \geq \dots \geq N_k \]

Jika jumlah pengguna pada stage berikutnya lebih besar daripada sebelumnya, komponen harus mendeteksi kondisi tersebut.

Jangan diam-diam mengubah atau memotong angka.

**C. Cohort consistency**

Ini sangat penting.

Conversion rate hanya valid jika numerator dan denominator merepresentasikan populasi yang sebanding, dengan aturan identitas, periode, dan attribution window yang konsisten.

Misalnya, jumlah purchase minggu ini tidak otomatis boleh dibagi dengan jumlah visitors minggu ini jika purchase berasal dari pengunjung minggu sebelumnya.

Karena itu, kita perlu membedakan:

|Analysis mode|Meaning|
|---|---|
|Sequential funnel|Pengguna melewati tahapan dalam urutan tertentu|
|Cohort funnel|Pengguna dikelompokkan berdasarkan waktu awal masuk|
|Period-based funnel|Aktivitas masing-masing stage dikelompokkan berdasarkan periode|

**Rekomendasi:** versi pertama mendukung sequential funnel dengan data yang sudah konsisten secara cohort atau attribution. Cohort-based funnel analysis dapat menjadi extension berikutnya.

# **5. Filter API dan controlled state**

Komponen perlu mendukung controlled dan uncontrolled usage.

```

export interface DateRange {
  from: string;
  to: string;
}

export interface FunnelAnalysisFilters {
  dateRange?: DateRange;

  segment?: string | null;

  granularity?:
    | 'daily'
    | 'weekly'
    | 'monthly';
}

export interface FunnelAnalysisSelection {
  selectedStageId?: string | null;

  selectedTransitionId?: string | null;

  visibleSeriesIds?: string[];
}
```

Aturan:

- Jika parent memberikan `filters`, parent menjadi pemilik filter state.
    
- Jika tidak, komponen mengelola filter internal.
    
- Prinsip yang sama berlaku untuk selection.
    
- Perubahan controlled state harus dikirim melalui callback.
    
- Tidak boleh ada dua sumber kebenaran

---

# **6. Event API — interaction contract**

Semua event harus menggunakan application-level event types, bukan meneruskan raw ECharts event sebagai public API.

### **Event definitions**

```

export type FunnelAnalysisEvent =
  | {
      type: 'stage.select';
      stageId: string | null;
    }
  | {
      type: 'transition.select';
      transitionId: string | null;
    }
  | {
      type: 'series.visibility.change';
      seriesIds: string[];
    }
  | {
      type: 'filter.change';
      filters: FunnelAnalysisFilters;
    }
  | {
      type: 'trend.point.click';
      point: FunnelTrendPoint;
    }
  | {
      type: 'selection.reset';
    };
```

Tambahkan satu callback generik untuk kebutuhan integrasi yang lebih luas:

```
onEvent?: (event: FunnelAnalysisEvent) => void;
```

### **Event behavior**

|Event|Payload|Result|
|---|---|---|
|`stage.select`|stage ID|Update stage selection|
|`transition.select`|transition ID|Update transition selection|
|`series.visibility.change`|visible IDs|Update legend state|
|`filter.change`|filters|Update shared filters|
|`trend.point.click`|data point|Notify parent|
|`selection.reset`|none|Clear selections|

### **Interaction precedence**

Agar interaksi tidak saling bertentangan:

1. Filter changes memicu recalculation dan invalidasi selection yang tidak lagi relevan.
    
2. Explicit selection mengalahkan hover.
    
3. Hover tidak boleh mengubah selected state.
    
4. Legend visibility tidak boleh mengubah selection.
    
5. Reset mengembalikan selection dan visibility ke konfigurasi default.
    
6. Parent-controlled state selalu menjadi sumber kebenaran.
    

# **7. Data validation and error handling**

Sebelum data masuk ke chart, lakukan validation.

Saya merekomendasikan empat kategori validasi:

|Category|Example|Behavior|
|---|---|---|
|Structural|Missing stage ID|Reject invalid dataset|
|Referential|Unknown stage reference|Reject invalid dataset|
|Numerical|Negative count|Reject invalid observation|
|Analytical|Next stage exceeds previous stage|Warning or invalid analysis|

### **Validation result contract**

```

export type ValidationSeverity =
  | 'error'
  | 'warning'
  | 'info';

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  stageId?: string;
  period?: string;
}

export interface FunnelValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
```

Contoh validation codes:

- `MISSING_STAGE`
    
- `DUPLICATE_STAGE_ID`
    
- `INVALID_STAGE_ORDER`
    
- `UNKNOWN_STAGE_REFERENCE`
    
- `NEGATIVE_COUNT`
    
- `NON_MONOTONIC_FUNNEL`
    
- `ZERO_DENOMINATOR`
    
- `MISSING_PERIOD_DATA`
    
- `INCONSISTENT_COUNTING_UNIT`
    
- `INCONSISTENT_COHORT`
    

**Penting:** `ZERO_DENOMINATOR` bukan berarti dataset selalu invalid. Conversion harus menjadi `null` atau unavailable, bukan `Infinity`, `NaN`, atau 0%.

Untuk kondisi non-monotonic funnel, sediakan kebijakan:

- `strict`: reject analisis.
    
- `warning`: tampilkan data dan tandai hasil sebagai non-standard.
    
- `allow`: izinkan visualisasi dengan status khusus.
    

Default yang saya rekomendasikan adalah `warning`, dengan validasi structural dan numerical tetap strict.

# **8. Insight Engine API**

Insight engine harus terpisah dari chart rendering.

Contoh output:

**Key Insights**

**Highest drop-off**

Checkout → Purchase

# **68.8%**

Largest observed transition loss

**Improving conversion**

Visitors → Product Views

# **+2.1 pp**

Compared with the previous equivalent period

**Overall conversion**

Visitors → Purchase

# **8.0%**

Illustrative insight layout.

### **Insight contract**

```

export interface FunnelInsight {
  id: string;

  type:
    | 'highest_dropoff'
    | 'improving'
    | 'declining'
    | 'stable'
    | 'overall_conversion'
    | 'anomaly';

  severity:
    | 'positive'
    | 'neutral'
    | 'warning'
    | 'critical';

  title: string;
  description: string;

  stageId?: string;
  transitionId?: string;

  value?: number;
  change?: number;

  comparisonPeriod?: string;
}
```

Insight engine memiliki tanggung jawab:

1. Mengidentifikasi transition dengan drop-off tertinggi.
    
2. Mendeteksi perubahan conversion rate.
    
3. Membandingkan periode yang setara.
    
4. Mengidentifikasi anomali.
    
5. Menghasilkan ringkasan overall conversion.
    

Jangan menyebut sebuah perubahan signifikan secara statistik tanpa pengujian statistik yang memadai. Bedakan perubahan percentage points (pp) dari perubahan persentase relatif (%).

# **9. Test specification**

Testing dibagi menjadi empat lapisan.

Layer 1

**Unit Tests**

Metric calculations, aggregation, validation, insight generation.

Layer 2

**Component Tests**

Props, loading, empty state, filters, selections, callbacks.

Layer 3

**Integration Tests**

Cross-chart synchronization, shared state, filter propagation.

Layer 4

**Visual & Accessibility Tests**

Responsive layout, chart rendering, keyboard, contrast, visual regression.

### **A. Unit test cases**

|Test|Expected result|
|---|---|
|Cumulative conversion|Correct percentage|
|Stage conversion|Correct adjacent-stage ratio|
|Drop-off|Correct complement|
|Overall conversion|Final / initial|
|Zero denominator|Null result|
|Negative count|Validation error|
|Missing stage|Validation error|
|Non-monotonic counts|Warning|
|Missing time period|Preserve data gap|
|Weekly aggregation|Correct numerator/denominator|
|Monthly aggregation|Correct numerator/denominator|

Contoh:

```
describe('calculateFunnelMetrics', () => {
  it('calculates cumulative conversion', () => {
    expect(
      calculateCumulativeConversion(
        800,
        10000
      )
    ).toBe(8);
  });

  it('returns null for zero denominator', () => {
    expect(
      calculateStageConversion(0, 0)
    ).toBeNull();
  });

  it('calculates drop-off correctly', () => {
    expect(
      calculateDropOff(80, 100)
    ).toBe(20);
  });
});
```

### **B. Integration test cases**

- Select funnel stage → trend series highlight.
    
- Select trend transition → funnel highlight.
    
- Change date range → both charts update.
    
- Change segment → both charts update.
    
- Toggle legend → series visibility updates.
    
- Reset → restore initial selection.
    
- Loading state → no mixed filter-context data.
    
- Unmount → no lingering chart listeners.
    

### **C. Visual regression scenarios**

Buat baseline screenshot untuk:

1. Desktop default.
    
2. Desktop selected stage.
    
3. Desktop selected transition.
    
4. Desktop dark mode.
    
5. Tablet layout.
    
6. Mobile layout.
    
7. Empty state.
    
8. Loading state.
    
9. Error state.
    
10. Partial-data state.
    

# **10. Mock dataset and test fixtures**

Coding agent membutuhkan test fixtures yang representatif. Jangan hanya menguji satu dataset normal.

Saya merekomendasikan enam fixture standar.

|Fixture|Scenario|Purpose|
|---|---|---|
|`standard-funnel`|Normal sequential funnel|Baseline|
|`high-dropoff-funnel`|Large loss at final stage|Insight detection|
|`zero-volume-funnel`|Zero users|Division-by-zero handling|
|`non-monotonic-funnel`|Later stage exceeds earlier stage|Data validation|
|`incomplete-funnel`|Missing observations|Partial-data handling|
|`large-funnel`|Large number of stages and periods|Performance|

### **Interactive test dataset**

Kita gunakan dataset kecil untuk integration tests:

```

export const standardFunnelFixture = {
  id: 'test-funnel',
  name: 'Test Funnel',

  stages: [
    { id: 'visitors', label: 'Visitors', order: 1 },
    { id: 'views', label: 'Views', order: 2 },
    { id: 'cart', label: 'Cart', order: 3 },
    { id: 'checkout', label: 'Checkout', order: 4 },
    { id: 'purchase', label: 'Purchase', order: 5 },
  ],

  periods: [
    {
      period: '2026-W01',
      stages: [
        { stageId: 'visitors', count: 1000 },
        { stageId: 'views', count: 700 },
        { stageId: 'cart', count: 350 },
        { stageId: 'checkout', count: 175 },
        { stageId: 'purchase', count: 70 },
      ],
    },
    {
      period: '2026-W02',
      stages: [
        { stageId: 'visitors', count: 1200 },
        { stageId: 'views', count: 840 },
        { stageId: 'cart', count: 480 },
        { stageId: 'checkout', count: 240 },
        { stageId: 'purchase', count: 120 },
      ],
    },
  ],
};
```

Expected results for Week 1:

|Metric|Expected|
|---|---|
|Overall conversion|7%|
|Visitors → Views|70%|
|Views → Cart|50%|
|Cart → Checkout|50%|
|Checkout → Purchase|40%|
|Highest drop-off|60%|

Expected results for Week 2:

|Metric|Expected|
|---|---|
|Overall conversion|10%|
|Visitors → Views|70%|
|Views → Cart|57.14%|
|Cart → Checkout|50%|
|Checkout → Purchase|50%|

Ini dapat digunakan sebagai golden test dataset untuk memastikan kalkulasi tidak berubah ketika komponen dikembangkan.

# **11. API design refinements**

Sebelum coding, ada tiga penyempurnaan yang perlu dimasukkan ke kontrak awal.

### **A. Segment data support**

API filter sebelumnya menyediakan `segment`, tetapi data contract belum mendefinisikan struktur segment.

Tambahkan:

```
export interface FunnelSegment {
  id: string;
  label: string;
}

export interface FunnelAnalysisData {
  id: string;
  name: string;
  stages: FunnelStage[];
  periods: FunnelPeriodData[];

  segments?: FunnelSegment[];

  metadata?: FunnelMetadata;
}
```

Untuk versi pertama, terdapat dua mode:

- `preFiltered`: parent mengirim dataset yang sudah difilter.
    
- `dimensionAware`: dataset menyediakan observasi berdasarkan segment.
    

Jangan menerima segment filter yang tidak didukung dataset tanpa memberi feedback kepada pengguna.

### **B. Controlled versus uncontrolled state**

Gunakan aturan yang konsisten:

|API|Controlled|Uncontrolled|
|---|---|---|
|`filters`|Parent owns state|Component owns state|
|`selection`|Parent owns state|Component owns state|
|`loading`|Parent owns state|Default false|
|`data`|Parent supplies data|Required|

Jangan membuat internal state yang diam-diam bertentangan dengan controlled props.

### **C. Data aggregation semantics**

Untuk agregasi periode, conversion rate harus dihitung dari jumlah count yang sesuai, bukan rata-rata sederhana dari conversion rate setiap periode.

Contoh:

\[ CR_{aggregate} = \frac{\sum N_{next}}{\sum N_{previous}}\times100 \]

Ini mencegah periode dengan volume kecil memiliki bobot yang sama dengan periode ber-volume besar.

Aturan ini hanya valid jika observation cohort dan attribution semantics konsisten.

# **12. Implementation task breakdown**

Sekarang spesifikasi bisa dipecah menjadi pekerjaan coding agent.

Saya merekomendasikan pendekatan bertahap agar setiap bagian dapat diverifikasi sebelum masuk ke bagian berikutnya.

**Implementation roadmap**

8 work packages

1. **WP-01 — Foundation & Types**
    
    Project structure, TypeScript types, public API, design tokens.
    
    Foundation
    
2. **WP-02 — Metric Engine**
    
    Calculations, aggregation, data validation, unit tests.
    
    Business logic
    
3. **WP-03 — Funnel Visualization**
    
    ECharts funnel, labels, metrics, drop-off indicators, tooltip.
    
    Visualization
    
4. **WP-04 — Conversion Trend**
    
    Line series, axes, tooltip, legend, zoom and responsive rendering.
    
    Visualization
    
5. **WP-05 — Interaction Coordinator**
    
    Shared state, cross-chart selection, hover, filtering and synchronization.
    
    Interaction
    
6. **WP-06 — Insights Engine**
    
    Insight generation, comparisons, trend summaries and anomalies.
    
    Analytics
    
7. **WP-07 — Composite Component**
    
    Integrate panels, shared controls, responsive layout and all UI states.
    
    Integration
    
8. **WP-08 — Quality & Verification**
    
    Integration tests, accessibility, visual regression, performance and documentation.
    
    Release gate
    

## **13. Definition of Done**

Komponen tidak boleh dinyatakan selesai hanya karena chart berhasil dirender.

Kriteria penyelesaian:

**Functional**

- Kedua chart bekerja.
    
- Seluruh metrik benar.
    
- Cross-chart interaction bekerja.
    
- Filter dan selection konsisten.
    
- Insight berasal dari data aktual.
    

**Technical**

- TypeScript strict mode.
    
- Business logic terpisah dari ECharts.
    
- Public API terdokumentasi.
    
- Tidak ada memory leak atau event listener yang tertinggal.
    
- Tidak ada dependency pada dataset tertentu.
    

**Quality**

- Unit tests lulus.
    
- Integration tests lulus.
    
- Visual regression lulus.
    
- Accessibility diperiksa.
    
- Responsive layout diverifikasi.
    
- Error dan empty states diuji.
    

**Documentation**

- README.
    
- Component API reference.
    
- Data contract.
    
- Metric definitions.
    
- Interaction contract.
    
- Usage examples.
    
- Testing instructions.
    

# **14. Final technical decisions**

Berikut baseline keputusan yang saya rekomendasikan untuk component versi pertama.

|Area|Decision|
|---|---|
|Component|`FunnelAnalysis`|
|Framework|React + TypeScript|
|Visualization|Apache ECharts|
|Architecture|Composite component|
|State|React reducer|
|Data model|Stage definitions + period observations|
|Metrics|Derived pure functions|
|Chart coordination|Shared interaction coordinator|
|Filtering|Controlled/uncontrolled|
|Insights|Rule-based insight engine|
|Testing|Vitest + React Testing Library|
|Visual testing|Screenshot regression|
|Accessibility|WCAG 2.2 AA target|
|Responsive|Desktop, tablet, mobile|

## **15. Hal yang perlu dipertimbangkan sebelum implementasi**

Ada satu batasan analitis yang perlu kita jaga: funnel dengan data agregat per periode tidak otomatis dapat membuktikan bahwa orang yang masuk ke stage pertama adalah orang yang sama dengan yang mencapai stage terakhir.

Untuk penggunaan produksi, kita harus menetapkan cohort dan attribution semantics secara eksplisit. Ini akan menentukan apakah metrik yang dihasilkan benar-benar valid sebagai conversion funnel.

Saya menyarankan:

- MVP: sequential funnel dengan dataset yang sudah memenuhi konsistensi counting dan attribution.
    
- Extension: cohort-based funnel analysis.
    
- Extension berikutnya: comparative funnel dan segment-level analysis.
    

# **16. Final deliverable status**

**Funnel Analysis Component**

Specification package defined

# **100%**

Cakupan spesifikasi yang telah didefinisikan, bukan persentase implementasi kode.

Visual design specification

Component architecture

Metric definitions

Interaction contract

ECharts configuration

React component API

Data contract

Validation rules

Insight engine

Test specification

Implementation roadmap

Definition of Done

**Rekomendasi saya untuk langkah berikutnya:**

Jangan langsung meminta coding agent membangun seluruh komponen sekaligus.

Buat dahulu satu paket dokumentasi implementasi yang terdiri dari:

1. `README.md` — overview dan cara menggunakan komponen.
    
2. `COMPONENT-SPEC.md` — arsitektur dan public API.
    
3. `DATA-CONTRACT.md` — data schema dan metric definitions.
    
4. `INTERACTION-SPEC.md` — seluruh interaksi dan state transitions.
    
5. `ECHARTS-CONFIG.md` — konfigurasi visual dan rendering.
    
6. `TEST-SPEC.md` — test cases dan acceptance criteria.
    
7. `IMPLEMENTATION-PLAN.md` — delapan work packages beserta dependency dan verification gates.
    

Dengan pendekatan ini, spesifikasi menjadi **agent-ready, testable, reusable, dan implementation-oriented**.

Satu hal yang belum kita lakukan adalah memeriksa repository aplikasi tempat komponen ini akan dipasang. Karena itu, keputusan versi dependency, integrasi dengan design system, dan struktur folder final masih perlu disesuaikan dengan repository aktual sebelum coding dimulai.