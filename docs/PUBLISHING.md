# PANDUAN PUBLISH — funnel-chart

Panduan menerbitkan package `funnel-chart` ke npm. Saat ini publish **nonaktif**
(`"private": true` di `package.json`) — ikuti langkah di bawah saat siap.

---

## 1. Prasyarat sekali saja

### 1.1 Akun npm & token

1. Buat/akses akun di <https://www.npmjs.com> (verified email wajib untuk publish).
2. Buat **Automation token**: npmjs.com → Access Tokens → Generate New Token →
   type **Automation** (bisa publish dari CI tanpa 2FA interaktif).
3. Salin token — hanya ditampilkan sekali.

### 1.2 Simpan token di GitHub

Repo `jensuid/funnel-chart` → **Settings → Secrets and variables → Actions →
New repository secret**:

- Name: `NPM_TOKEN`
- Secret: isi token dari 1.1

### 1.3 Environment approval (opsional tapi disarankan)

Workflow `publish` memakai environment `npm-publish`. Buat protection agar
publish butuh persetujuan manual:

Repo → **Settings → Environments → New environment** → nama `npm-publish` →
Required reviewers → pilih diri sendiri.

### 1.4 Aktifkan package

Edit `package.json`:

```diff
-  "private": true,
```

Pastikan juga sudah benar:

- `version` sesuai rilis pertama (mis. `0.1.0`)
- `repository.url` → `git+https://github.com/jensuid/funnel-chart.git` ✅ (sudah)
- `files: ["dist"]` ✅ (sudah — hanya `dist/`, `LICENSE`, `README.md` yang masuk tarball)

---

## 2. Alur rilis (setiap kali publish)

### 2.1 Pastikan main hijau

```bash
git checkout main && git pull
pnpm verify            # atau: pnpm typecheck && pnpm test
```

CI di GitHub harus lulus job `verify` sebelum lanjut.

### 2.2 Naikkan versi

Pilih sesuai perubahan (Semantic Versioning):

| Jenis perubahan | Perintah |
|---|---|
| Perbaikan bug, tanpa API baru | `pnpm version patch` → 0.1.**1** |
| Fitur baru, API lama tetap kompatibel | `pnpm version minor` → 0.**2**.0 |
| Perubahan API yang memutus (`breaking`) | `pnpm version major` → **1**.0.0 |

`pnpm version` otomatis membuat commit + tag `v<versi>`.

### 2.3 (Disarankan) Coba kering dulu

```bash
pnpm build:lib
pnpm pack --dry-run     # periksa isi tarball: js, cjs, css, d.ts
pnpm publish --dry-run  # simulasi publish, tidak mengirim apa pun
```

Periksa daftar file: **tidak boleh** ada `node_modules`, `tests/`, `src/`, atau
snapshot Playwright di dalam tarball.

### 2.4 Push tag → CI mem-publish

```bash
git push origin main --follow-tags
# atau hanya tag-nya:
git push origin v0.1.0
```

Workflow CI akan:

1. Menjalankan job `verify` (typecheck, test, build:lib, pack).
2. Jika lulus → job `publish` berjalan pada tag `v*`, menunggu approval
   environment `npm-publish` (jika 1.3 diaktifkan), lalu `pnpm publish --access public`.

Pantau di tab **Actions**: <https://github.com/jensuid/funnel-chart/actions>

### 2.5 Alternatif: publish manual dari lokal

Jika tidak lewat CI:

```bash
pnpm prepublishOnly    # test + typecheck + build:lib (dipanggil otomatis)
pnpm login             # sekali
pnpm publish --access public
```

---

## 3. Verifikasi setelah publish

```bash
pnpm view funnel-chart version          # versi terbaru di registry
pnpm view funnel-chart dist.tarball     # URL tarball
```

Uji instalasi bersih di folder sementara:

```bash
mkdir /tmp/test-fc && cd /tmp/test-fc && npm init -y
npm install funnel-chart react react-dom echarts
node -e "const m=require('funnel-chart'); console.log(Object.keys(m).length)"
# harapan: 24 export
```

Untuk konsumen ESM + React:

```ts
import { FunnelAnalysis } from "funnel-chart";
import "funnel-chart/funnel-chart.css";
```

---

## 4. Jika ada yang salah setelah publish

| Situasi | Tindakan |
|---|---|
| Versi rusak / bug kritis | Publish patch sesegera mungkin; **jangan** hapus versi (npm melarang unpublish > 24 jam dan merusak konsumen) |
| Perlu menandai versi bermasalah | `npm deprecate funnel-chart@0.1.0 "reason"` |
| Publish versi lama sebagai `latest` | `npm dist-tag add funnel-chart@0.1.1 latest` |
| Salah publish & < 24 jam | `npm unpublish funnel-chart@0.1.0 --force` (pilihan terakhir) |

---

## 5. Masalah umum

| Gejala | Penyebab & solusi |
|---|---|
| `E403 ... unable to publish` | Nama `funnel-chart` mungkin sudah dipakai orang lain di npm — cek `pnpm view funnel-chart` ; jika dipakai, ganti nama package (mis. `@jensuid/funnel-chart`, lalu sesuaikan `exports` + `publishConfig.access`) |
| `ENEEDAUTH` di CI | `NPM_TOKEN` belum diset / salah scope token |
| `E426` / 2FA error | Token bukan type **Automation** — buat ulang |
| `private` error | `"private": true` masih ada di `package.json` |
| Tag dipush tapi publish tidak jalan | Tag harus berpola `v*`; cek tab Actions dan apakah job `verify` lulus |
| Git error saat `pnpm version` | Commit dulu semua perubahan (`git status` harus bersih) |

---

## 6. Checklist ringkas

- [ ] CI `verify` hijau di `main`
- [ ] `pnpm version <patch|minor|major>` (commit + tag otomatis)
- [ ] `pnpm pack --dry-run` — isi tarball bersih
- [ ] `git push origin main --follow-tags`
- [ ] Approve environment `npm-publish` di Actions (jika diaktifkan)
- [ ] `pnpm view funnel-chart version` menunjukkan versi baru
- [ ] Uji instalasi bersih di folder sementara
