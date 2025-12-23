# ADMIN MODULE SPECIFICATION
Crazy Vast System

## 1. TUJUAN MODULE ADMIN
Module Admin bertugas **mengelola master data organisasi DAN penarikan data operasional (READ-ONLY)**.
Admin TIDAK:
- input sales
- set target
- approve / reject apa pun

Admin BOLEH:
- mengatur struktur user & toko
- menarik data lintas area untuk kebutuhan laporan
- menjaga konsistensi data

---

## 2. ROLE ADMIN
- Admin adalah **role di tabel users**
- Login menggunakan **sistem login yang sama**
- Akses ditentukan oleh `users.role = 'admin'`

---

## 3. STRUKTUR MENU ADMIN



---

## 4. PROMOTOR MANAGEMENT
[tidak berubah]

---

## 5. SATOR MANAGEMENT
[tidak berubah]

---

## 6. SPV MANAGEMENT
[tidak berubah]

---

## 7. STORE MANAGEMENT
[tidak berubah]

---

## 8. AREA MANAGEMENT
[tidak berubah]

---

## 9. DATA EXPORT (WAJIB)

Menu ini bersifat **READ-ONLY**, khusus untuk penarikan data ke Excel.

### Tujuan
- Memberikan admin kemampuan menarik data **per area**
- Digunakan untuk:
  - reporting
  - audit
  - kebutuhan management offline

---

### Filter yang WAJIB Ada
Admin harus bisa memilih:

- Area (dropdown / ALL)
- Rentang tanggal:
  - start_date
  - end_date
- Atau mode:
  - Bulanan (YYYY-MM)
  - Harian (date range)

---

### Jenis Data yang Bisa Ditarik

#### A. Data Target
- Area
- Periode
- Nilai target
- Tanggal ditetapkan
- Dibuat oleh (manager)

#### B. Data Sales
- Tanggal sales
- Area
- Store
- Promotor
- Sator
- SPV
- Status (ACC / Pending / Reject)
- Phone type (jika ada)

#### C. Rekap (opsional)
- Total sales per area
- Total sales per store
- Total sales per promotor

---

### Output
- Format: **Excel (.xlsx)**
- Sheet dipisah:
  - Sheet 1: Summary
  - Sheet 2: Detail Area
  - Sheet 3: Detail Store
  - Sheet 4: Detail Promotor

---

### Aturan Wajib
- Admin **tidak boleh mengedit data dari hasil export**
- Export **berdasarkan data aktual di database**
- Filter tanggal harus mempengaruhi semua sheet
- Tidak boleh ada data di luar scope filter

---

## 10. AUDIT LOG (WAJIB)

Semua aksi admin HARUS dicatat:
- user_id admin
- action (create / update / deactivate / export)
- entity_type
- entity_id (nullable untuk export)
- filter_used (json)
- timestamp

---

## 11. PRINSIP TEKNIS (NON-NEGOTIABLE)

- ❌ Hard delete dilarang
- ✅ Gunakan `is_active`
- Semua perubahan tervalidasi
- Data export = READ-ONLY
- Tidak boleh ada hierarchy loop

---

## 12. SCOPE YANG TIDAK BOLEH ADA DI ADMIN
- Dashboard KPI real-time
- Approval sales
- Input target
- Edit hasil export

---

## 13. KESIMPULAN
Admin adalah:
- penjaga struktur
- penarik data lintas area
- pihak netral (non-operasional)

Module Admin adalah **fondasi stabilitas & audit sistem**.
