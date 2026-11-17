Kita masuk ke tahap berikutnya: **ECharts Visual Configuration & Interaction Design**.

Pada tahap ini, kita menerjemahkan component specification menjadi aturan rendering dan interaksi yang lebih teknis. Fokusnya bukan sekadar menentukan warna dan bentuk chart, tetapi memastikan kedua visualisasi benar-benar bekerja sebagai satu sistem.

Target akhirnya adalah spesifikasi yang dapat diterjemahkan coding agent menjadi implementasi React + Apache ECharts tanpa harus menebak perilaku chart.

# **1. ECharts visualization architecture**

Saya merekomendasikan pendekatan **ECharts as Rendering Engine, React as Interaction Orchestrator**.

**React — FunnelAnalysis**

Owns application state and user interactions

**Funnel ECharts**

Funnel series · Labels · Tooltip

**Trend ECharts**

Line series · Legend · Tooltip

**Shared Interaction Coordinator**

Stage selection · Transition selection · Highlighting · Filter synchronization

Prinsip penting:

- React menjadi pemilik shared state.
    
- ECharts mengelola rendering dan interaksi lokal chart.
    
- ECharts events diteruskan ke React.
    
- React mengoordinasikan perubahan antarchart.
    
- Chart options dibuat dari data dan state, bukan menjadi tempat menyimpan business logic.
    

Jangan mengandalkan `dispatchAction` sebagai sumber kebenaran state aplikasi.

# **2. Funnel chart — visual configuration**

[E-commerce in 2026: From Platform to Profit | Devimus](https://images.openai.com/static-rsc-4/NHe7aMKKg8s2oTh1lhC-oktdw70nw40iv0ddTPKFwn3QA2V5-HfSawFNUxTSXDWrRse3sFQcAKIh3GPMpvlYdPer0wxurC4gk72UXiBFH0iGC0rAdo-iTSlBFGJHl_OR9StyREh78OrllwjhUMTPduSNBUMbAAvfuZ6rzC6ycjI?purpose=inline)

**Recommended ECharts series type:** `funnel`

Konfigurasi visual:

|Property|Specification|
|---|---|
|Orientation|Vertical|
|Sort|Descending|
|Funnel width|70–85% of panel|
|Gap|4–6 px|
|Shape|Trapezoid|
|Border radius|Subtle|
|Label position|Inside|
|Emphasis|Selected stage|
|Animation|Smooth transition|

Warna stage menggunakan palet yang konsisten:

|Stage|Color|
|---|---|
|Visitors|Blue|
|Product Views|Cyan|
|Add to Cart|Teal|
|Checkout|Green|
|Purchase|Amber|

**Label contract**

Setiap stage harus menampilkan:

- Stage name.
    
- Absolute count.
    
- Cumulative conversion percentage.
    

Di luar funnel, tampilkan transition metrics berupa stage-to-stage conversion dan drop-off.

Jangan menggunakan nilai stage-to-stage conversion sebagai nilai funnel width. Lebar funnel harus mewakili volume stage.

# **3. Conversion trend — visual configuration**

[How to Make a Line Chart with AI: The Complete 2026 Guide to Design Rules | by Steven Cen | Mar, 2026 | Medium](https://images.openai.com/static-rsc-4/vgMFDd4rJCtXSJZVySwfcYndls9JMGNXkIQ3EtXaDPjPYiMp2Kj8HJH-cMs99g-Q-B49D03LTgUpmLe2KP-nZSKk9xJqf30AE7_uBJ5UP02Xp5pD4WbiZH40ASiCiHOHppfxbY7IbbskxEJmVRrJ6iEDqYO1NpFvUncHWLFIe0s?purpose=inline)

**Recommended ECharts series type:** `line`

### **Series mapping**

Setiap transition menjadi satu line series.

|Series ID|From → To|Color|
|---|---|---|
|`visitor-to-view`|Visitors → Product Views|Blue|
|`view-to-cart`|Product Views → Add to Cart|Cyan|
|`cart-to-checkout`|Add to Cart → Checkout|Green|
|`checkout-to-purchase`|Checkout → Purchase|Amber|

### **Axis configuration**

|Property|Specification|
|---|---|
|X-axis|Time|
|Y-axis|Conversion rate (%)|
|Y-axis minimum|0|
|Y-axis maximum|100|
|Grid|Horizontal subtle lines|
|Line width|2–2.5 px|
|Symbol|Circle|
|Symbol size|6 px|
|Smooth|Optional, default false|
|Area fill|Optional, very subtle|
|Connect nulls|false|

Y-axis 0–100% menjaga interpretasi antarperiode konsisten. Jika data sangat terkonsentrasi pada rentang sempit, pengguna dapat diberi opsi zoom, tetapi jangan diam-diam mengubah skala.

### **Tooltip specification**

Saat pengguna mengarahkan pointer ke data point, tampilkan:

**Week 5**

Visitors → Product Views

**66.7%**

Product Views → Cart

**53.8%**

Cart → Checkout

**50.0%**

Checkout → Purchase

**25.8%**

Tooltip harus menampilkan semua series yang visible untuk periode yang sama. Jangan menampilkan series yang sudah dinonaktifkan oleh legend.

# **4. Cross-chart interaction design**

Ini adalah bagian yang paling membedakan komponen kita dari dashboard dengan dua chart biasa.

### **Scenario A — User selects a funnel stage**

Misalnya pengguna memilih `Add to Cart`.

**Selected stage**

Add to Cart

**Add to Cart**

# **51,200**

40.0% cumulative conversion

Corresponding transitions are highlighted

Incoming

**Product Views → Add to Cart**

# **61.8%**

Outgoing

**Add to Cart → Checkout**

# **64.0%**

Expected behavior:

1. Selected stage mendapatkan emphasis pada funnel.
    
2. Incoming dan outgoing transition di-highlight pada trend.
    
3. Series lain menjadi subdued, bukan langsung dihapus.
    
4. Key Insights memperbarui konteks stage.
    
5. Pengguna tetap dapat melihat keseluruhan funnel.
    

**Penting:** Memilih stage tidak otomatis menyembunyikan series lainnya. Visibility dan selection merupakan dua state berbeda.

### **Scenario B — User selects a trend series**

Misalnya pengguna memilih `Checkout → Purchase`.

Expected behavior:

- Highlight transition tersebut.
    
- Highlight kedua stage yang terkait.
    
- Tampilkan drop-off dan conversion rate.
    
- Update contextual insights.
    
- Pertahankan filter dan date range.
    

### **Scenario C — User changes date range**

Kedua chart harus diperbarui secara atomik:

```
Date Range Changed
        |
        v
Update Shared Filter State
        |
        v
Load / Aggregate Data
        |
        v
Recalculate Metrics
        |
        +------------------+
        |                  |
        v                  v
  Funnel Overview    Conversion Trend
        |                  |
        +--------+---------+
                 |
                 v
          Update Insights
```

Jika loading berlangsung, pertahankan data sebelumnya dengan indikator bahwa data sedang diperbarui. Jangan mencampurkan hasil dari dua filter context.

# **5. Animation and transition behavior**

|Event|Animation|
|---|---|
|Initial render|Fade + scale|
|Data update|Smooth morph where valid|
|Stage selection|150–200 ms emphasis|
|Series highlight|150 ms|
|Filter change|Update after data resolution|
|Legend toggle|Smooth series transition|
|Reset selection|Restore normal emphasis|

Hindari animasi berlebihan yang mengganggu pembacaan tren.

Reduced-motion preference harus dihormati.

# **6. ECharts option architecture**

Saya merekomendasikan konfigurasi berbasis factory functions, bukan konfigurasi chart yang ditulis langsung di dalam React component.

Struktur yang disarankan:

```
funnel-analysis/
├── components/
│   ├── FunnelAnalysis.tsx
│   ├── FunnelOverview.tsx
│   ├── ConversionTrend.tsx
│   └── KeyInsights.tsx
├── charts/
│   ├── createFunnelOption.ts
│   ├── createTrendOption.ts
│   ├── tooltipFormatter.ts
│   └── chartTheme.ts
├── state/
│   ├── funnelAnalysisReducer.ts
│   └── interactionCoordinator.ts
├── metrics/
│   ├── calculateFunnelMetrics.ts
│   └── aggregateTrendMetrics.ts
├── adapters/
│   └── normalizeFunnelData.ts
├── types/
│   └── funnelAnalysis.types.ts
└── __tests__/
    ├── metrics.test.ts
    ├── interactions.test.ts
    └── component.test.tsx
```

### **Funnel option factory**

```
function createFunnelOption(
  data: FunnelStageViewModel[],
  state: FunnelAnalysisState
): EChartsOption {
  return {
    animation: true,
    animationDuration: 300,
    tooltip: {
      trigger: 'item'
    },
    series: [{
      type: 'funnel',
      sort: 'descending',
      orient: 'vertical',
      minSize: '0%',
      maxSize: '100%',
      gap: 5,
      label: {
        show: true,
        position: 'inside',
        formatter: '{b}\n{c}'
      },
      data
    }]
  };
}
```

Ini merupakan kerangka awal, bukan konfigurasi produksi final. Label, cumulative percentage, emphasis, dan styling harus dihubungkan dengan view model yang telah divalidasi.

### **Trend option factory**

```
function createTrendOption(
  data: FunnelTrendViewModel[],
  state: FunnelAnalysisState
): EChartsOption {
  return {
    animation: true,
    animationDuration: 300,
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'line'
      }
    },
    legend: {
      type: 'scroll'
    },
    xAxis: {
      type: 'category',
      data: data.map(item => item.period)
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: {
        formatter: '{value}%'
      }
    },
    series: buildTransitionSeries(data, state)
  };
}
```

`buildTransitionSeries` bertanggung jawab membangun empat line series berdasarkan transition IDs, bukan berdasarkan posisi array.

### **ECharts event contract**

Gunakan event yang sesuai:

|ECharts event|Application action|
|---|---|
|`click`|Update selected stage/transition|
|`mouseover`|Update hovered item|
|`mouseout`|Clear hover state|
|`legendselectchanged`|Update visible series|
|`datazoom`|Update displayed time window, jika zoom diaktifkan|

Hindari memasang event listener berulang setiap kali options diperbarui. Lifecycle event subscription harus dikelola secara benar oleh React integration.

# **7. Performance and reliability**

Beberapa aturan implementasi:

- Gunakan `setOption` dengan strategi update yang mempertahankan instance chart.
    
- Hindari membuat ulang instance ECharts pada setiap state change.
    
- Gunakan stable IDs untuk stages dan transitions.
    
- Gunakan memoization untuk perhitungan dan chart options.
    
- Pisahkan data aggregation dari rendering.
    
- Bersihkan event listeners ketika component unmount.
    
- Gunakan `ResizeObserver` melalui integrasi React atau mekanisme resize library.
    
- Gunakan lazy rendering jika dashboard memuat banyak chart.
    
- Hindari animasi ketika perubahan data terlalu besar atau tidak memiliki korespondensi yang valid.
    

Untuk ukuran data besar, lakukan aggregation sebelum data diteruskan ke ECharts.

# **8. Visual acceptance checklist**

- Funnel width proporsional terhadap volume.
    
- Funnel labels konsisten.
    
- Cumulative conversion benar.
    
- Drop-off indicator benar.
    
- Empat transition series tampil dengan warna konsisten.
    
- Y-axis menggunakan skala yang konsisten.
    
- Tooltip sinkron berdasarkan periode.
    
- Legend dapat mengontrol series.
    
- Stage selection memengaruhi trend.
    
- Transition selection memengaruhi funnel.
    
- Hover dan selection tidak saling menimpa.
    
- Filter update kedua panel secara konsisten.
    
- Tidak ada stale event listeners.
    
- Resize dan responsive layout berfungsi.
    
- Reduced motion didukung.
    

# **9. Technical decisions to lock**

Berikut rekomendasi keputusan teknis untuk implementasi.

|Decision|Recommendation|
|---|---|
|Chart engine|Apache ECharts|
|React integration|echarts-for-react atau controlled ECharts wrapper|
|Chart configuration|Factory functions|
|State management|React reducer|
|Cross-chart communication|Shared interaction coordinator|
|Metric calculation|Pure TypeScript functions|
|Tooltip|Custom HTML formatter|
|Animation|Native ECharts animation|
|Responsive|ResizeObserver|
|Testing|Vitest + React Testing Library|

## **10. Implementation readiness**

## **Specification progress**

Visual design

Completed

Component architecture

Defined

Metric definitions

Defined

Interaction contract

Defined

ECharts configuration

Specified

Implementation API contract

Next

Test fixtures & verification

Pending

**Rekomendasi tahap selanjutnya: Component API & Test Specification.**

Kita perlu mendefinisikan secara presisi:

1. Public React component API (`props`, callbacks, configuration).
    
2. Data input dan output contract.
    
3. Interaction event contract.
    
4. Default configuration dan customization options.
    
5. Mock datasets untuk berbagai skenario funnel.
    
6. Unit, integration, dan visual regression test cases.
    

Setelah tahap itu selesai, kita akan memiliki paket spesifikasi yang cukup lengkap untuk diberikan kepada coding agent sebagai implementation task, tanpa perlu menebak-nebak desain maupun perilakunya.