# ARCHITECTURE OVERVIEW
## VAST FINANCE – TRACKING & MONITORING SYSTEM

---

## 1. TUJUAN DOKUMEN

Dokumen ini menjelaskan **arsitektur sistem secara menyeluruh**, dari:
- input data
- pemrosesan
- penyimpanan
- agregasi
- konsumsi dashboard

Dokumen ini dibuat agar:
- Developer baru langsung paham alur
- Tidak salah tempat logika
- Tidak mencampur tanggung jawab frontend / backend / database
- Sistem bisa dirawat **tanpa ketergantungan pada satu orang**

---

## 2. PRINSIP ARSITEKTUR (DIKUNCI)

1. **Database sebagai sumber kebenaran**
2. **Dashboard TIDAK membaca data mentah**
3. **Agregasi dilakukan di database**
4. **Frontend hanya konsumsi data**
5. **Logic bisnis TIDAK disimpan di UI**

---

## 3. KOMPONEN UTAMA SISTEM

### 3.1 Frontend
- Next.js
- Tailwind CSS
- Mobile-first (PWA)
- Tidak melakukan perhitungan bisnis

Tugas frontend:
- Form input pengajuan
- Menampilkan dashboard
- Export Excel / PNG
- Filter data (bukan hitung data)

---

### 3.2 Backend / API Layer
- Supabase (Postgres)
- Supabase Edge Functions (logic ringan)
- Auth & role handling

Tugas backend:
- Validasi input
- Menulis data transaksi
- Menjalankan query agregat
- Menjaga aturan akses data

---

### 3.3 Database
- PostgreSQL (Supabase)
- Schema ternormalisasi
- Agregat disiapkan khusus untuk dashboard

Database adalah:
> **SINGLE SOURCE OF TRUTH**

---

## 4. ALUR DATA UTAMA (END-TO-END)

### 4.1 Input Pengajuan (Promotor)

1. Promotor mengisi form di frontend
2. Frontend mengirim data ke backend
3. Backend insert ke:
vast_finance_data_new

yaml
Copy code
4. Nilai default:
- approval_status = approved
- transaction_status = not_closed

❗ Tidak ada agregat di tahap ini

---

### 4.2 Perubahan Status

#### A. Reject
- approval_status → rejected
- transaction_status tetap not_closed

#### B. Closing Direct
- transaction_status → closed
- Tidak ada record di `conversions`

#### C. Closing Follow-up
1. Awalnya pending
2. Promotor follow-up
3. Insert ke `conversions`
4. transaction_status → closed

---

## 5. AGREGASI DATA (INTI SISTEM)

### 5.1 Kapan Agregasi Dijalankan
- Setelah insert / update transaksi
- Bisa:
- via Edge Function
- via job terjadwal
- via manual trigger

❗ Tidak menggunakan database trigger berat

---

### 5.2 Jenis Agregat

#### A. Promotor
- `agg_daily_promoter`
- `agg_monthly_promoter`

#### B. Toko
- `agg_daily_store`
- `agg_monthly_store`

---

### 5.3 Fungsi Agregat
- Menyederhanakan query
- Menjaga performa
- Menghindari hitung ulang di frontend
- Stabil di free tier Supabase

---

## 6. KONSUMSI DATA OLEH DASHBOARD

### 6.1 Dashboard Promotor
- Baca tabel agregat promotor
- Filter by user_id

### 6.2 Dashboard SPV / SATOR
- Baca tabel agregat promotor
- Filter via `hierarchy`

### 6.3 Dashboard Manager Area
- Baca agregat promotor & toko
- Filter by area

### 6.4 Dashboard SPC
- Baca agregat toko
- Filter `stores.is_spc = true`
- Akses dibatasi (whitelist)

👉 **Detail lengkap ada di `READ_CONTRACT_DASHBOARD.md`**

---

## 7. KENAPA DASHBOARD DILARANG BACA DATA MENTAH

Alasan teknis:
- Query berat
- Boros resource
- Lambat di mobile
- Tidak stabil di free tier

Alasan bisnis:
- Definisi bisa salah
- Angka bisa beda
- Sulit audit

Solusi:
> **Dashboard hanya baca agregat**

---

## 8. STRATEGI SCALING (LOW COST)

- User bertambah → agregat tetap kecil
- Data mentah bertambah → dashboard tetap cepat
- Arsip data lama → tidak mengganggu UI

Desain ini cocok untuk:
- 5–10 tahun pemakaian
- Tim kecil
- Maintenance minimal

---

## 9. STRATEGI MAINTENANCE

- Schema jelas
- Dokumen lengkap
- Tidak tergantung satu developer
- Mudah onboard agent baru

Jika developer berganti:
- Baca dokumen
- Ikuti kontrak
- Sistem tetap jalan

---

## 10. STRUKTUR DOKUMEN PROYEK (DISARANKAN)

/docs
├── DATABASE_NORMALIZED_SPEC.md
├── DATABASE_CHANGE_PLAN.md
├── READ_CONTRACT_DASHBOARD.md
└── ARCHITECTURE_OVERVIEW.md

yaml
Copy code

---

## 11. PENUTUP

Arsitektur ini dirancang:
- sederhana
- jelas
- tidak over-engineering
- tahan lama

Jika semua aturan dipatuhi:
- sistem stabil
- angka konsisten
- maintenance ringan

Dokumen ini adalah **peta besar sistem**.