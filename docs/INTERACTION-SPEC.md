# INTERACTION-SPEC — seleksi, hover, visibility, filter

## Model state (`funnelAnalysisReducer.ts`)

State interaksi dipisah dari data. Aturan invarian:

1. **Mutual exclusivity** — memilih stage menghapus pilihan transition, dan sebaliknya.
2. **Hover tidak pernah menyentuh selection** — hover hanya mengubah highlight sementara.
3. **Visibility tidak menyentuh selection** — menyembunyikan series via legend tidak membatalkan pilihan.
4. **Filter invalidation** — perubahan filter membatalkan selection yang tidak lagi valid.
5. **Reset** — `reset()` mengosongkan selection, hover, visibility, dan filter.

## Koordinasi (`interactionCoordinator.ts`)

- `useFunnelInteraction` — hook orkestrator; mendukung **controlled** (prop `selection`) dan **uncontrolled** (state internal).
- Helper murni (mudah dites):
  - `adjacentTransitionIds(stageId)` — transitions mas/keluar stage.
  - `focusStageIds(state, transitions)` — stage yang di-highlight untuk seleksi transition.
  - `focusTransitionIds(state, transitions)` — transitions yang di-highlight untuk seleksi stage.
  - `legendSelectionToVisibility(names, transitions)` — **legend ECharts keyed by series NAME**, dipetakan balik ke transition ID.

## Terjemahan event ECharts

Event chart (`click`, `mouseover`, `mouseout`, `legendselectchanged`) diterjemahkan
menjadi aksi reducer + callback publik (`onStageSelect`, `onTransitionSelect`,
`onSeriesVisibilityChange`, `onEvent`). EChartsWrapper berlangganan **sekali**
via ref dengan guard `isDisposed()` — dispose tidak me-detach handler secara
sinkron, jadi guard mencegah handler menyala setelah unmount.

## Perilaku kunci

- Klik stage → pilih stage; transitions in/out ikut di-highlight (`focusTransitionIds`).
- Klik transition → pilih transition; kedua stage endpoint di-highlight (`focusStageIds`).
- Legend toggle → series `visible: false` (subdued, tidak dihapus — Scenario A spec).
- Legend disembunyikan (`showLegend: false`) → handler `legendselectchanged` tidak dipasang.
- Callback selection selalu menerima ID kanonik, bukan nama series.
