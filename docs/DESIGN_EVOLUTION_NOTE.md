# DESIGN EVOLUTION NOTE
## VAST FINANCE – IMPORTANT CONTEXT FOR FUTURE DEVELOPERS

---

## 1. TUJUAN DOKUMEN INI

Dokumen ini dibuat untuk **mencegah kebingungan** bagi developer / agent baru  
yang membaca repository **tanpa mengikuti proses diskusi awal**.

Dokumen ini menjelaskan:
- Kenapa ada tabel agregat
- Kenapa ada VIEW agregat tambahan
- Kenapa ada data `old` dan `new`
- Kenapa desain terlihat “bertambah”, bukan diganti

Dokumen ini **BUKAN teknis**, tapi **konteks desain**.

---

## 2. KRONOLOGI SINGKAT DESAIN (PENTING)

### FASE 1 — DATA BARU DINORMALKAN
Awalnya sistem dirancang ulang untuk:
- menghilangkan status ambigu
- memisahkan approval vs closing
- membuat agregat yang stabil

Hasilnya:
- `vast_finance_data_new`
- tabel agregat:
  - `agg_daily_promoter`
  - `agg_monthly_promoter`
  - `agg_daily_store`
  - `agg_monthly_store`

Semua dashboard **awalnya hanya membaca tabel ini**.

---

### FASE 2 — KEBUTUHAN DATA HISTORIS
Setelah sistem baru stabil, muncul kebutuhan penting:
- data lama **TIDAK BOLEH hilang**
- laporan lintas tahun dibutuhkan
- performa lama perlu dibandingkan

Namun:
- struktur data lama tidak rapi
- status lama ambigu
- tidak aman jika dicampur langsung

---

### FASE 3 — SOLUSI RESMI (YANG DIPILIH)

Diputuskan bahwa:
- data lama **TETAP READ-ONLY**
- data baru **TETAP BERSIH**
- penyatuan **HANYA DI LEVEL AGREGAT**

Solusinya:
- membuat **VIEW agregat gabungan**
- tanpa mengubah tabel agregat utama

---

## 3. STRUKTUR DATA SAAT INI (FINAL)

### DATA OPERASIONAL (AKTIF)
- `vast_finance_data_new`
- digunakan untuk input & follow-up

### DATA HISTORIS (ARSIP AKTIF)
- `vast_finance_data_old`
- READ-ONLY

---

### AGREGAT UTAMA (LIVE DASHBOARD)
- `agg_daily_promoter`
- `agg_monthly_promoter`
- `agg_daily_store`
- `agg_monthly_store`

Digunakan untuk:
- dashboard harian
- monitoring aktif
- target berjalan

---

### AGREGAT HISTORIS (VIEW)
- `v_agg_daily_promoter_all`
- `v_agg_monthly_promoter_all`
- `v_agg_monthly_store_all`
- (opsional) `v_agg_daily_store_all`

Digunakan untuk:
- laporan lintas tahun
- grafik historis
- export data lama + baru

---

## 4. ATURAN MEMBACA DATA (SANGAT PENTING)

### Untuk monitoring harian & aktif
👉 **WAJIB gunakan tabel agregat**
agg_*

graphql
Copy code

### Untuk laporan historis / lintas tahun
👉 **WAJIB gunakan VIEW**
v_agg_*_all

yaml
Copy code

❌ Jangan mencampur
❌ Jangan UNION di frontend
❌ Jangan query data mentah lama

---

## 5. KENAPA TIDAK ADA MIGRASI DATA LAMA

Keputusan sadar:
- risiko mapping salah tinggi
- biaya maintenance besar
- nilai bisnis kecil

Solusi VIEW:
- aman
- murah
- fleksibel
- bisa dihapus kapan saja tanpa merusak data

---

## 6. DAMPAK KE DOKUMEN LAIN

Dokumen ini:
- **MENJELASKAN**, bukan mengubah
- semua dokumen lain **TETAP VALID**

Jika ada kebingungan:
👉 baca dokumen ini **SEBELUM** mengubah desain.

---

## 7. PESAN UNTUK DEVELOPER / AGENT BARU

Jika kamu membaca ini:
- jangan menyederhanakan desain
- jangan menghapus VIEW
- jangan memindahkan data lama
- jangan query data mentah untuk dashboard

Ikuti kontrak yang sudah ada.

---

## 8. STATUS DOKUMEN

- FINAL
- WAJIB ADA DI REPO
- DIBUAT UNTUK KONTINUITAS PROYEK
- MELINDUNGI DESAIN DARI SALAH PAHAM

---

## 9. PENUTUP

Desain ini **bertumbuh secara sadar**, bukan berubah arah.

Penambahan VIEW:
- bukan koreksi kesalahan
- tapi respons terhadap kebutuhan nyata

Dokumen ini memastikan:
> **yang datang belakangan tidak tersesat.**