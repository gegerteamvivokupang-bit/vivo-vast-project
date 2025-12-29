# PANDUAN MIGRASI DATA EXCEL → DATABASE
**Untuk Migrasi Data Bulan Desember 2024**

> 📋 Dokumen ini adalah panduan langkah-demi-langkah untuk migrasi data dari Excel ke tabel `vast_finance_data_new`

---

## 🎯 TUJUAN

Memindahkan data penjualan bulan Desember 2024 dari file Excel ke database dengan akurat dan aman.

---

## 📋 PERSIAPAN

### 1. File Excel yang Dibutuhkan

Upload file Excel Anda ke folder project (`f:\gpt_crazy_vast\data\`) dengan nama yang jelas, misalnya:
- `data_desember_2024.xlsx`
- `sales_december_2024.xlsx`

### 2. Struktur Excel yang Ideal

Pastikan Excel memiliki kolom-kolom berikut (nama kolom bisa berbeda, yang penting isinya):

| Kolom Excel | Mapping ke Database | Wajib? | Contoh Nilai |
|-------------|---------------------|--------|--------------|
| Tanggal | `sale_date` | ✅ Ya | 2024-12-01 |
| Nama Customer | `customer_name` | ✅ Ya | Budi Santoso |
| No HP Customer | `customer_phone` | ✅ Ya | 081234567890 |
| Pekerjaan | `pekerjaan` | ✅ Ya | Karyawan Swasta |
| Status | `status` | ✅ Ya | acc / pending / reject |
| Nama Promotor | `created_by_user_id` | ✅ Ya | AINI |
| Nama Toko | `store_id` | ✅ Ya | PAKARENA |
| Penghasilan | `penghasilan` | ⚠️ Opsional | 5000000 |
| NPWP | `has_npwp` | ⚠️ Opsional | Ya / Tidak |
| Limit Kredit | `limit_amount` | ⚠️ Opsional | 4000000 |
| DP | `dp_amount` | ⚠️ Opsional | 500000 |
| Tenor | `tenor` | ⚠️ Opsional | 12 |
| Tipe HP | `phone_type_id` | ⚠️ Opsional | Y21d Series |

---

## 🔍 VALIDASI DATA

### Cek 1: Validasi Pekerjaan

Pastikan nilai di kolom **Pekerjaan** sesuai dengan salah satu nilai berikut:
- Karyawan Swasta
- PNS/ASN
- Wiraswasta
- TNI/Polri
- Pensiunan
- Tidak Bekerja
- Lainnya

❌ **SALAH**: "Swasta", "Karyawan", "Pegawai"  
✅ **BENAR**: "Karyawan Swasta"

### Cek 2: Validasi Status

Pastikan nilai di kolom **Status** sesuai:
- `acc` atau `ACC` → Approved + Closing
- `pending` atau `PENDING` → Approved + Belum Closing
- `reject` atau `REJECT` → Rejected

### Cek 3: Validasi Nama Promotor

Pastikan nama promotor di Excel **sesuai dengan nama di database**.

Query untuk cek daftar promotor:
```sql
SELECT name, email FROM users 
WHERE role = 'promotor' AND status = 'active'
ORDER BY name;
```

Tips:
- Nama bisa dalam huruf kapital semua (Excel) vs Title Case (database)
- AI akan mapping otomatis, tapi pastikan ejaannya sama
- Kalau nama tidak ditemukan, harus mapping manual

### Cek 4: Validasi Nama Toko

Query untuk cek daftar toko:
```sql
SELECT name FROM stores 
WHERE is_active = true
ORDER BY name;
```

Daftar toko yang tersedia:
- ANDYS CELL
- BEST GADGET
- FATIMA CELL
- GARUDA CELL
- INFINITY CELL
- KERSEN CELL
- MARIA
- MUTIARA CELL
- NABILA CELL
- PAKARENA
- (dan lainnya...)

### Cek 5: Validasi Tipe HP (Opsional)

Query untuk cek daftar tipe HP:
```sql
SELECT name FROM phone_types 
WHERE is_active = true
ORDER BY name;
```

Daftar tipe HP yang tersedia:
- IQOO Series
- V60 Series
- X Series
- Y04 Series
- Y21d Series
- Y400 Series

---

## 🚀 LANGKAH MIGRASI

### STEP 1: Upload File Excel

Upload file Excel Anda ke folder `f:\gpt_crazy_vast\data\`

### STEP 2: AI Akan Membaca & Menganalisis Excel

AI akan:
1. ✅ Membaca struktur Excel
2. ✅ Mapping kolom Excel → kolom database
3. ✅ Validasi data (pekerjaan, status, dll)
4. ✅ Mapping nama promotor → UUID
5. ✅ Mapping nama toko → UUID
6. ✅ Mapping tipe HP → UUID (jika ada)
7. ✅ Generate SQL INSERT statements

### STEP 3: Review SQL yang Dihasilkan

AI akan menampilkan:
- Jumlah record yang akan di-insert
- Sample SQL (5-10 baris pertama)
- Laporan validasi (error/warning jika ada)

**ANDA HARUS REVIEW sebelum execute!**

### STEP 4: Backup Data Testing (PENTING!)

Sebelum insert data baru, backup data testing yang ada:

```sql
-- Backup data testing
CREATE TABLE vast_finance_data_new_testing_backup AS 
SELECT * FROM vast_finance_data_new;

-- Cek jumlah data backup
SELECT COUNT(*) FROM vast_finance_data_new_testing_backup;
```

### STEP 5: Hapus Data Testing

```sql
-- Hapus semua data testing
DELETE FROM vast_finance_data_new;

-- Verifikasi sudah kosong
SELECT COUNT(*) as total FROM vast_finance_data_new;
-- Hasil harus: 0
```

### STEP 6: Insert Data Desember

Execute SQL yang sudah di-generate oleh AI.

```sql
-- SQL INSERT akan berbentuk seperti ini:
INSERT INTO vast_finance_data_new (
    created_by_user_id,
    store_id,
    sale_date,
    customer_name,
    customer_phone,
    pekerjaan,
    status,
    approval_status,
    transaction_status,
    source,
    created_at,
    -- kolom lainnya...
) VALUES
(...),
(...),
(...);
```

### STEP 7: Validasi Data yang Sudah Masuk

```sql
-- Cek jumlah data per status
SELECT 
    status,
    COUNT(*) as total
FROM vast_finance_data_new
WHERE deleted_at IS NULL
GROUP BY status;

-- Cek data per tanggal
SELECT 
    sale_date,
    COUNT(*) as total
FROM vast_finance_data_new
WHERE deleted_at IS NULL
GROUP BY sale_date
ORDER BY sale_date;

-- Cek per promotor
SELECT 
    u.name as promotor,
    COUNT(*) as total_pengajuan
FROM vast_finance_data_new v
JOIN users u ON u.id = v.created_by_user_id
WHERE v.deleted_at IS NULL
GROUP BY u.name
ORDER BY total_pengajuan DESC;
```

---

## ⚠️ TROUBLESHOOTING

### Error: "violates foreign key constraint"

**Penyebab**: UUID promotor/toko/phone_type tidak ditemukan

**Solusi**:
1. Cek apakah nama promotor/toko sudah benar
2. Query ulang daftar promotor/toko dari database
3. Mapping manual jika perlu

### Error: "violates check constraint"

**Penyebab**: Nilai pekerjaan tidak sesuai enum

**Solusi**:
1. Cek kembali nilai kolom pekerjaan di Excel
2. Pastikan ejaannya persis sama dengan enum yang valid
3. Ubah nilai di Excel atau di SQL sebelum insert

### Warning: "Data promotor X tidak ditemukan"

**Penyebab**: Nama promotor di Excel tidak match dengan database

**Solusi**:
1. Cek typo/ejaan nama
2. Tanya user siapa promotor yang dimaksud
3. Mapping manual atau koreksi nama di Excel

---

## 📊 MONITORING SETELAH MIGRASI

### Dashboard Metrics

Setelah migrasi, cek dashboard untuk memastikan data tampil dengan benar:

1. **Dashboard Promotor**: Angka pengajuan, pending, closing, reject
2. **Dashboard SATOR**: Agregasi data per team
3. **Dashboard SPV**: Agregasi data per area
4. **History Page**: List transaksi harus muncul

### Query Monitoring

```sql
-- Total data Desember 2024
SELECT COUNT(*) 
FROM vast_finance_data_new
WHERE TO_CHAR(sale_date, 'YYYY-MM') = '2024-12'
  AND deleted_at IS NULL;

-- Data per hari
SELECT 
    sale_date,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'acc') as acc,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'reject') as reject
FROM vast_finance_data_new
WHERE TO_CHAR(sale_date, 'YYYY-MM') = '2024-12'
  AND deleted_at IS NULL
GROUP BY sale_date
ORDER BY sale_date;
```

---

## 🔐 BACKUP & ROLLBACK

### Backup Sebelum Migrasi

```sql
-- Backup seluruh tabel (termasuk data testing)
CREATE TABLE vast_finance_data_new_backup_20241226 AS 
SELECT * FROM vast_finance_data_new;
```

### Rollback Jika Ada Masalah

```sql
-- Restore dari backup
TRUNCATE vast_finance_data_new;

INSERT INTO vast_finance_data_new 
SELECT * FROM vast_finance_data_new_backup_20241226;

-- Verifikasi
SELECT COUNT(*) FROM vast_finance_data_new;
```

---

## ✅ CHECKLIST MIGRASI

Sebelum declare migrasi selesai, pastikan:

- [ ] File Excel sudah di-upload ke project
- [ ] AI sudah analisis struktur Excel
- [ ] Mapping promotor → UUID sudah benar (100%)
- [ ] Mapping toko → UUID sudah benar (100%)
- [ ] Validasi pekerjaan passed (no error)
- [ ] Validasi status passed (no error)
- [ ] Backup data testing sudah dibuat
- [ ] Data testing sudah dihapus
- [ ] SQL INSERT sudah di-review
- [ ] SQL INSERT berhasil dijalankan (no error)
- [ ] Validasi jumlah record sesuai dengan Excel
- [ ] Dashboard metrics tampil dengan benar
- [ ] History page menampilkan data Desember
- [ ] Agregasi harian/bulanan ter-update otomatis

---

## 📞 NEXT STEPS

Setelah dokumen ini dibuat, langkah selanjutnya:

1. ✅ **Upload file Excel** ke `f:\gpt_crazy_vast\data\`
2. ✅ AI akan **analisis file Excel**
3. ✅ AI akan **generate SQL migrasi**
4. ✅ User **review SQL**
5. ✅ User **execute SQL** di Supabase
6. ✅ User **validasi hasil migrasi**
7. ✅ **DONE!** 🎉

---

**Dokumen ini siap digunakan saat file Excel sudah ready!**
