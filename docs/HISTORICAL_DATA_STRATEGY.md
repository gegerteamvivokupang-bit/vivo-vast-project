# HISTORICAL DATA STRATEGY
## VAST FINANCE – LEGACY DATA HANDLING

---

## 1. TUJUAN DOKUMEN

Dokumen ini menjelaskan **strategi resmi menangani data historis**  
yang tersimpan di tabel `vast_finance_data_old`.

Tujuan utama:
- Menjaga **data historis tetap utuh**
- Memastikan data lama **tetap ikut perhitungan laporan**
- Mencegah pencampuran data mentah lama & baru
- Menjaga desain sistem **tetap bersih dan mudah dirawat**

Dokumen ini **WAJIB dibaca** sebelum menyentuh data lama.

---

## 2. STATUS TABEL `vast_finance_data_old`

### 2.1 Peran
`vast_finance_data_old` adalah:
> **DATA HISTORIS / LEGACY (READ-ONLY)**

Digunakan untuk:
- laporan masa lalu
- perbandingan historis
- kebutuhan audit
- referensi performa jangka panjang

---

### 2.2 Larangan Keras

❌ Tidak boleh INSERT  
❌ Tidak boleh UPDATE  
❌ Tidak boleh DELETE  
❌ Tidak boleh dipakai untuk input baru  
❌ Tidak boleh dipakai langsung oleh dashboard  

---

## 3. PEMISAHAN TANGGUNG JAWAB DATA

### 3.1 Data Baru (Operasional)
Tabel:
- `vast_finance_data_new`

Digunakan untuk:
- input berjalan
- follow-up
- conversion
- perhitungan target aktif

---

### 3.2 Data Lama (Historis)
Tabel:
- `vast_finance_data_old`

Digunakan untuk:
- histori sebelum sistem baru
- laporan lintas tahun
- data pembanding

---

> **Data lama dan data baru TIDAK PERNAH dicampur di level transaksi.**

---

## 4. STRATEGI PENYATUAN DATA (KUNCI DESAIN)

### PRINSIP UTAMA

> **Penyatuan data hanya boleh dilakukan di LEVEL AGREGAT.**

Bukan:
- di tabel transaksi
- di frontend
- di logika manual

---

## 5. MODEL PENYATUAN YANG RESMI

### 5.1 Agregat Data Lama

Data di `vast_finance_data_old`:
- dihitung TERPISAH
- menghasilkan agregat historis

Contoh (konsep):
- agregat harian promotor (historis)
- agregat bulanan toko (historis)

---

### 5.2 View Gabungan (UNION)

Untuk konsumsi dashboard historis, dibuat **VIEW GABUNGAN**:

Contoh nama view:
- `v_agg_daily_promoter_all`
- `v_agg_monthly_promoter_all`
- `v_agg_daily_store_all`
- `v_agg_monthly_store_all`

Isi view:
- UNION antara:
  - agregat historis (dari data old)
  - agregat berjalan (dari tabel agg_ baru)

---

### 5.3 Tanggung Jawab Dashboard

- Dashboard **TIDAK TAHU** sumber data (old / new)
- Dashboard hanya baca **VIEW**
- Logika penyatuan **100% di database**

---

## 6. CONTOH KONSEP (BAHASA MANUSIA)

### Laporan Bulanan Promotor

- Data sebelum go-live:
  - dihitung dari `vast_finance_data_old`
- Data setelah go-live:
  - dihitung dari `agg_monthly_promoter`

Keduanya:
> digabung di VIEW → dashboard baca satu sumber

---

## 7. KENAPA DATA LAMA TIDAK DIMIGRASIKAN

Alasan utama:
- Struktur lama tidak ternormalisasi
- Status ambigu
- Risiko salah mapping tinggi
- Biaya maintenance besar

Keputusan desain:
> **vast_finance_data_old = arsip aktif, bukan fondasi baru**

---

## 8. DAMPAK KE DOKUMEN LAIN

Dokumen ini:
- **MENAMBAH**, bukan mengganti
- Tidak mengubah:
  - `READ_CONTRACT_DASHBOARD.md`
  - `API_CONTRACT.md`
  - `ARCHITECTURE_OVERVIEW.md`

Hanya memperluas cakupan historis.

---

## 9. ATURAN UNTUK DEVELOPER / AGENT

Jika butuh data historis:
1. Cari VIEW agregat gabungan
2. Jangan query `vast_finance_data_old` langsung
3. Jangan UNION manual di frontend

Jika butuh data berjalan:
- gunakan tabel agregat existing

---

## 10. STATUS DOKUMEN

- FINAL
- WAJIB DIPATUHI
- TIDAK BOLEH DILANGGAR
- MENJADI PEGANGAN DATA HISTORIS

---

## 11. PENUTUP

Dengan strategi ini:
- data lama aman
- data baru bersih
- dashboard konsisten
- sistem tahan lama

Dokumen ini memastikan:
> **sejarah tidak hilang, masa depan tidak kacau.**