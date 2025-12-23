# READ CONTRACT DASHBOARD
## VAST FINANCE – DATA CONSUMPTION RULES

---

## 1. TUJUAN DOKUMEN

Dokumen ini mendefinisikan **aturan resmi membaca data untuk semua dashboard**  
di sistem VAST Finance Tracking.

Dokumen ini dibuat agar:
- Developer / agent baru **langsung paham**
- Tidak ada tafsir bebas
- Tidak ada perbedaan angka antar dashboard
- Sistem stabil dan mudah dirawat jangka panjang

Jika aturan di dokumen ini dilanggar:
- Angka dashboard akan salah
- Target tidak konsisten
- Debug akan berulang
- Pekerjaan menjadi kacau

---

## 2. ATURAN UMUM (WAJIB DIPATUHI)

### ✅ TABEL YANG BOLEH DIBACA DASHBOARD
Dashboard **HANYA BOLEH** membaca tabel berikut:

- `agg_daily_promoter`
- `agg_monthly_promoter`
- `agg_daily_store`
- `agg_monthly_store`
- `stores` (metadata saja, contoh: `is_spc`)
- `hierarchy` (untuk filter akses)

---

### ❌ TABEL YANG DILARANG DIBACA DASHBOARD

Dashboard **TIDAK BOLEH** membaca tabel berikut:

- `vast_finance_data_new`
- `conversions`

Tabel di atas hanya digunakan oleh:
- backend
- proses agregasi
- audit

Bukan untuk UI.

---

## 3. DEFINISI METRIK (FINAL & TIDAK BOLEH DIUBAH)

| Istilah di Dashboard | Sumber Data |
|--------------------|------------|
| Closing / Pencapaian | `total_closed` |
| Pending | `total_pending` |
| Closing Direct | `total_closing_direct` |
| Closing Follow-up | `total_closing_followup` |

Tidak ada definisi lain selain ini.

---

## 4. DASHBOARD PROMOTOR

### 4.1 Tabel Sumber
- Harian: `agg_daily_promoter`
- Bulanan: `agg_monthly_promoter`

### 4.2 Filter WAJIB
```sql
promoter_user_id = current_user.id

4.3 Data yang Ditampilkan

Target bulanan

Pencapaian (total_closed)

Pending hari ini

Breakdown:

Closing Direct

Closing Follow-up

4.4 Larangan

Tidak boleh query transaksi mentah

Tidak boleh hitung manual di frontend

5. DASHBOARD SPV & SATOR

SPV dan SATOR memiliki perilaku data yang SAMA.

5.1 Tabel Sumber

Harian: agg_daily_promoter

Bulanan: agg_monthly_promoter

5.2 Filter WAJIB (Hierarchy)
promoter_user_id IN (
  SELECT user_id
  FROM hierarchy
  WHERE atasan_id = current_user.id
)

5.3 Hak Akses

Bisa melihat semua promotor di bawahnya

Tidak bisa melihat promotor area lain

6. DASHBOARD MANAGER AREA
6.1 Tabel Sumber

Promotor:

agg_daily_promoter

agg_monthly_promoter

Toko:

agg_daily_store

agg_monthly_store

6.2 Filter Area
promoter_user_id IN (
  SELECT user_id
  FROM hierarchy
  WHERE area = current_user.area
)

7. DASHBOARD TOKO
7.1 Tabel Sumber

Harian: agg_daily_store

Bulanan: agg_monthly_store

7.2 Filter
store_id = selected_store_id

8. DASHBOARD SPC (SPECIAL STORE GROUP)
8.1 Definisi SPC

SPC ditentukan oleh:

stores.is_spc = true

8.2 Tabel Sumber

Harian: agg_daily_store

Bulanan: agg_monthly_store

8.3 Filter SPC
store_id IN (
  SELECT id
  FROM stores
  WHERE is_spc = true
)

8.4 Hak Akses SPC

HANYA user berikut:

Manager Area

SPV Gery

SATOR Andri

Whitelist ini HARDCODED, bukan dari database.

9. REPORT & EXPORT
9.1 Export Excel

Sumber data: tabel agregat

Filter:

tanggal

bulan

Tidak boleh ambil dari transaksi mentah

9.2 Export PNG

Snapshot dari dashboard

Angka harus sama persis dengan agregat

10. KESALAHAN YANG PALING SERING TERJADI (DILARANG)

❌ Query vast_finance_data_new untuk dashboard
❌ Menggabungkan data mentah dengan agregat
❌ Menghitung ulang di frontend
❌ Mengubah definisi closing / pending

Jika angka tidak cocok:
👉 Periksa tabel agregat, bukan UI

11. STATUS DOKUMEN

FINAL

WAJIB DIPATUHI

MENJADI PEGANGAN SEMUA DEVELOPER

TIDAK BOLEH DIUBAH TANPA KEPUTUSAN BISNIS

12. PENUTUP

Dengan kontrak ini:

Frontend hanya konsumsi data

Tidak ada debat angka

Tidak ada tafsir bebas

Sistem stabil dan tahan lama

Dokumen ini adalah sumber kebenaran tunggal untuk semua dashboard.


---

### Rekomendasi Struktur Folder Repo
Agar rapi dan profesional:
