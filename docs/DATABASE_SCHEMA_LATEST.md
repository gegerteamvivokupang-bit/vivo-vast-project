# DATABASE SCHEMA TERBARU - VAST FINANCE
**Terakhir Update: 26 Desember 2024**

> ⚠️ **DOKUMEN INI ADALAH SUMBER KEBENARAN TUNGGAL (SINGLE SOURCE OF TRUTH)**  
> Dokumen ini dibuat berdasarkan CEK LANGSUNG ke database production, BUKAN dari file migrasi.

---

## 📊 DAFTAR TABEL

Database memiliki **14 tabel utama**:

### Tabel Data Utama
1. `vast_finance_data_new` - Tabel transaksi pengajuan kredit (TABEL UTAMA)
2. `vast_finance_data_old` - Data legacy (untuk referensi historis)
3. `conversions` - Data konversi pending → closing
4. `targets` - Data target bulanan per user

### Tabel Master Data
5. `users` - Data user (promotor, sator, spv, manager, admin)
6. `stores` - Data toko
7. `phone_types` - Tipe handphone
8. `hierarchy` - Struktur organisasi (promotor → sator → spv → manager)

### Tabel Agregasi (Auto-Generated)
9. `agg_daily_promoter` - Agregasi harian per promotor
10. `agg_daily_store` - Agregasi harian per toko
11. `agg_monthly_promoter` - Agregasi bulanan per promotor
12. `agg_monthly_store` - Agregasi bulanan per toko

### Tabel Mapping (Legacy)
13. `user_id_mapping` - Mapping ID user lama → baru
14. `user_id_mapping_promotor` - Mapping ID promotor lama → baru

---

## 1️⃣ TABEL: `vast_finance_data_new`

**Tabel utama untuk semua transaksi pengajuan kredit HP**

### Struktur Kolom (23 kolom)

| Kolom | Tipe Data | Nullable | Default | Keterangan |
|-------|-----------|----------|---------|------------|
| `id` | uuid | NO | `uuid_generate_v4()` | Primary Key |
| `created_by_user_id` | uuid | NO | - | FK ke `users.id` (promotor yang input) |
| `store_id` | uuid | NO | - | FK ke `stores.id` |
| `sale_date` | date | NO | - | Tanggal penjualan |
| `customer_name` | text | NO | - | Nama customer |
| `customer_phone` | text | NO | - | Nomor HP customer (format +62...) |
| `customer_ktp_image_url` | text | YES | null | URL foto KTP (Cloudinary) |
| `pekerjaan` | text | NO | - | Jenis pekerjaan customer |
| `penghasilan` | numeric | YES | null | Penghasilan customer |
| `has_npwp` | boolean | YES | false | Apakah punya NPWP |
| `status` | text | NO | - | Status LEGACY ('acc', 'pending', 'reject') |
| `limit_amount` | numeric | YES | null | Limit kredit yang disetujui |
| `dp_amount` | numeric | YES | null | Uang muka (DP) |
| `tenor` | integer | YES | null | Tenor cicilan (bulan) |
| `phone_type_id` | uuid | YES | null | FK ke `phone_types.id` |
| `proof_image_url` | text | YES | null | URL bukti pengajuan (DEPRECATED) |
| `source` | text | YES | 'form' | Sumber data ('form', 'migration_excel', dll) |
| `created_at` | timestamptz | YES | `now()` | Waktu record dibuat |
| `updated_at` | timestamptz | YES | `now()` | Waktu record diupdate |
| `deleted_at` | timestamptz | YES | null | Soft delete timestamp |
| `approval_status` | text | NO | 'approved' | Status approval ('approved', 'rejected') |
| `transaction_status` | text | NO | 'not_closed' | Status transaksi ('closed', 'not_closed') |
| `image_urls` | text[] | YES | '{}' | Array URL gambar (KTP + bukti) |

### Nilai Valid untuk Enum/Constraint

#### `pekerjaan` (berdasarkan constraint check)
- Karyawan Swasta
- PNS/ASN
- Wiraswasta
- TNI/Polri
- Pensiunan
- Tidak Bekerja
- Lainnya

#### `status` (LEGACY - masih dipakai tapi akan deprecated)
- `acc` → approved + closed
- `pending` → approved + not_closed
- `reject` → rejected + not_closed

#### `approval_status` (BARU - mulai digunakan)
- `approved` → Kredit disetujui
- `rejected` → Kredit ditolak

#### `transaction_status` (BARU - mulai digunakan)
- `closed` → Customer sudah ambil HP (closing)
- `not_closed` → Customer belum ambil HP

### Catatan Penting
- ✅ Kolom `image_urls` adalah **ARRAY**, bisa menampung multiple gambar
- ✅ `approval_status` + `transaction_status` adalah sistem **BARU** yang lebih jelas
- ⚠️ Kolom `status` masih ada untuk backward compatibility
- ⚠️ `customer_ktp_image_url` dan `proof_image_url` sudah digantikan oleh `image_urls`

### Contoh Data
```sql
-- Contoh record ACC (Closing)
{
  "id": "35214a9e-923f-463a-91f1-6353083ee865",
  "status": "acc",
  "approval_status": "approved",
  "transaction_status": "closed",
  "sale_date": "2025-12-23",
  "customer_name": "DEPLOY TES",
  "limit_amount": 5000000,
  "dp_amount": 452000,
  "tenor": 12
}

-- Contoh record PENDING
{
  "id": "fc73f346-0a50-4cd0-ae69-310813fda460",
  "status": "pending",
  "approval_status": "approved",
  "transaction_status": "not_closed",
  "sale_date": "2025-12-23",
  "customer_name": "DEPLOY PENDING TEST",
  "limit_amount": 5000000,
  "dp_amount": 532000,
  "tenor": 6
}

-- Contoh record REJECT
{
  "id": "e23f284e-4c0f-47cf-b0fd-5657ff013339",
  "status": "reject",
  "approval_status": "rejected",
  "transaction_status": "not_closed",
  "sale_date": "2025-12-24",
  "customer_name": "REJECT SELVI"
}
```

---

## 2️⃣ TABEL: `stores`

**Master data toko**

### Struktur Kolom (6 kolom)

| Kolom | Tipe Data | Nullable | Default | Keterangan |
|-------|-----------|----------|---------|------------|
| `id` | uuid | NO | `uuid_generate_v4()` | Primary Key |
| `name` | text | NO | - | Nama toko |
| `area` | text | NO | - | Area toko ('KABUPATEN', 'KOTA', dll) |
| `is_active` | boolean | YES | true | Status aktif toko |
| `created_at` | timestamptz | YES | `now()` | Waktu dibuat |
| `is_spc` | boolean | YES | false | Apakah toko SPC (Special Program) |

### Total Toko
- **Total**: 10+ toko aktif
- **Area**: Mayoritas KABUPATEN

### Contoh Data
```sql
-- Sample toko
{
  "id": "c67687dd-043b-4d91-a2ab-81cd6730effd",
  "name": "ANDYS CELL",
  "area": "KABUPATEN",
  "is_spc": false
}
{
  "id": "43032de3-edac-4d21-888d-53eba194a296",
  "name": "PAKARENA",
  "area": "KABUPATEN",
  "is_spc": false
}
```

### List Toko (10 toko pertama)
1. ANDYS CELL
2. BEST GADGET
3. FATIMA CELL
4. GARUDA CELL
5. INFINITY CELL
6. KERSEN CELL
7. MARIA
8. MUTIARA CELL
9. NABILA CELL
10. PAKARENA

---

## 3️⃣ TABEL: `users`

**Master data user (semua role)**

### Struktur Kolom (12 kolom)

| Kolom | Tipe Data | Nullable | Default | Keterangan |
|-------|-----------|----------|---------|------------|
| `id` | uuid | NO | `uuid_generate_v4()` | Primary Key |
| `email` | text | NO | - | Email user (unique) |
| `name` | text | NO | - | Nama lengkap |
| `employee_id` | text | NO | - | ID karyawan |
| `phone` | text | YES | null | Nomor telepon |
| `role` | text | NO | - | Role user |
| `status` | text | NO | - | Status user |
| `pin_hash` | text | YES | null | Hash PIN untuk login |
| `created_at` | timestamptz | YES | `now()` | Waktu dibuat |
| `updated_at` | timestamptz | YES | `now()` | Waktu diupdate |
| `promotor_status` | text | YES | null | Status khusus promotor ('active', 'inactive', dll) |
| `store_id` | uuid | YES | null | FK ke `stores.id` (khusus promotor) |

### Nilai Valid untuk Enum

#### `role`
- `promotor` - Sales promotor di toko
- `sator` - Supervisor toko (membawahi beberapa promotor)
- `spv` - Supervisor area (membawahi beberapa sator)
- `manager` - Manager area (membawahi beberapa spv)
- `admin` - Administrator sistem

#### `status`
- `active` - User aktif
- `inactive` - User non-aktif

### Catatan Penting
- ✅ Hanya role **promotor** yang punya `store_id`
- ✅ Hierarchy: promotor → sator → spv → manager
- ✅ Login menggunakan `email` + `pin_hash`

### Contoh Data Promotor
```sql
{
  "id": "218f4692-3309-4fc5-bab0-8bd119af7b7e",
  "name": "AINI RAHMATINI NATALIA MOESTAKIM",
  "email": "aini@vast.com",
  "role": "promotor",
  "status": "active",
  "store_id": "43032de3-edac-4d21-888d-53eba194a296" -- PAKARENA
}
{
  "id": "9b2e793b-e1b8-45ec-a2ba-fc5c57059742",
  "name": "ADRIANA",
  "email": "adriana@vast.com",
  "role": "promotor",
  "status": "active",
  "store_id": "89cca833-3a3d-4c35-bb28-352eaeacd4a6" -- MUTIARA CELL
}
```

---

## 4️⃣ TABEL: `phone_types`

**Master data tipe handphone**

### Struktur Kolom (4 kolom)

| Kolom | Tipe Data | Nullable | Default | Keterangan |
|-------|-----------|----------|---------|------------|
| `id` | uuid | NO | `uuid_generate_v4()` | Primary Key |
| `name` | text | NO | - | Nama seri HP (misal: "Y21d Series") |
| `is_active` | boolean | YES | true | Status aktif |
| `created_at` | timestamptz | YES | `now()` | Waktu dibuat |

### Catatan Penting
- ⚠️ **TIDAK ada kolom `brand` dan `model`** (berbeda dari dokumentasi lama)
- ✅ Kolom `name` langsung berisi nama lengkap seri (misal: "IQOO Series", "Y21d Series")
- ✅ Semua data adalah produk VIVO

### List Tipe HP
```sql
-- 6 tipe HP yang tersedia
{
  "id": "402297b5-8f4e-43c6-b9e4-354182df4adc",
  "name": "IQOO Series"
}
{
  "id": "bd74b84f-9a0f-4ca9-9444-3828635e3aa7",
  "name": "V60 Series"
}
{
  "id": "7bee4b48-e53e-4d26-bf4d-11ab4592d7d6",
  "name": "X Series"
}
{
  "id": "0bf7ca3e-7cab-462f-9076-9bca67a67fb6",
  "name": "Y04 Series"
}
{
  "id": "ccd53aa2-13d7-48e1-a849-4eea47b91af1",
  "name": "Y21d Series"
}
{
  "id": "c28af8e6-7c48-4d7c-acc4-2aa549b50eea",
  "name": "Y400 Series"
}
```

---

## 5️⃣ TABEL: `hierarchy`

**Struktur organisasi (chain of command)**

### Struktur Kolom (7 kolom)

| Kolom | Tipe Data | Nullable | Default | Keterangan |
|-------|-----------|----------|---------|------------|
| `id` | uuid | NO | `uuid_generate_v4()` | Primary Key |
| `user_id` | uuid | NO | - | FK ke `users.id` |
| `atasan_id` | uuid | YES | null | FK ke `users.id` (atasan langsung) |
| `area` | text | YES | null | Area kerja ('ALL', 'KABUPATEN', 'KOTA', dll) |
| `store_id` | uuid | YES | null | FK ke `stores.id` (khusus promotor) |
| `created_at` | timestamptz | YES | `now()` | Waktu dibuat |
| `updated_at` | timestamptz | YES | `now()` | Waktu diupdate |

### Cara Kerja
- **Promotor**: punya `atasan_id` (SATOR) dan `store_id`
- **SATOR**: punya `atasan_id` (SPV), `store_id` null
- **SPV**: punya `atasan_id` (Manager), `store_id` null
- **Manager**: `atasan_id` null, `area` = 'ALL'

### Contoh Data
```sql
-- Manager (top level)
{
  "user_id": "c2f9b868-0cdd-4d19-953a-ae03bdf859b2",
  "atasan_id": null,
  "area": "ALL",
  "store_id": null
}

-- Promotor (bottom level)
{
  "user_id": "44e3bdda-3da6-444f-bd32-f01d869bbc3b", -- ALITA D PAU
  "atasan_id": "c388b787-87ec-492d-ab83-98f660259eb4", -- SATOR
  "area": null,
  "store_id": "2c77c57b-14ca-49fe-a48d-7644ad67982f"
}
```

---

## 6️⃣ TABEL: `conversions`

**Data konversi pending → closing (hasil follow-up)**

### Deskripsi
Tabel ini mencatat konversi dari status `pending` (approved tapi belum ambil HP) menjadi `closing` (customer jadi ambil HP) setelah proses follow-up.

### Catatan
- ⚠️ Belum dicek detail strukturnya
- ✅ Dipakai untuk membedakan:
  - **Direct Closing**: Approved langsung jadi closing
  - **Follow-up Closing**: Approved → Pending → Closing (ada record di tabel ini)

---

## 7️⃣ TABEL: `targets`

**Data target bulanan per user**

### Deskripsi
Tabel ini menyimpan target penjualan bulanan untuk setiap user (promotor, sator, spv, manager).

### Catatan
- ⚠️ Belum dicek detail strukturnya
- ✅ Ada kolom: `user_id`, `period_month`, `period_year`, `target_type`, `target_amount`
- ✅ Target bisa berbeda per role (promotor, sator, dll)

---

## 8️⃣ TABEL AGREGASI

### `agg_daily_promoter`
Agregasi data harian per promotor (auto-generated by trigger)

### `agg_daily_store`
Agregasi data harian per toko (auto-generated by trigger)

### `agg_monthly_promoter`
Agregasi data bulanan per promotor (auto-generated by trigger)

### `agg_monthly_store`
Agregasi data bulanan per toko (auto-generated by trigger)

### Catatan
- ✅ Tabel-tabel ini **otomatis di-refresh** oleh database trigger
- ✅ Digunakan untuk dashboard performance
- ⚠️ **JANGAN insert/update manual** ke tabel ini
- ✅ Data akan otomatis ter-update saat ada perubahan di `vast_finance_data_new`

---

## 9️⃣ TABEL MAPPING (LEGACY)

### `user_id_mapping`
Mapping ID user lama (varchar) → ID user baru (uuid)

### `user_id_mapping_promotor`
Mapping ID promotor lama → ID promotor baru

### Catatan
- ⚠️ Tabel untuk migrasi data lama, tidak dipakai untuk operasional
- ✅ Bisa diabaikan untuk data baru

---

## 📝 CATATAN PENTING UNTUK MIGRASI DATA

### Data yang Wajib Disiapkan dari Excel

Untuk migrasi data Excel → `vast_finance_data_new`, **WAJIB** ada kolom:

1. **Tanggal Penjualan** → `sale_date`
2. **Nama Customer** → `customer_name`
3. **Nomor HP Customer** → `customer_phone`
4. **Pekerjaan** → `pekerjaan` (harus sesuai enum di atas)
5. **Status** → `status` ('acc', 'pending', 'reject')
6. **Nama Promotor** atau **Email Promotor** → untuk mapping ke `created_by_user_id`
7. **Nama Toko** → untuk mapping ke `store_id`

### Data Opsional (kalau ada di Excel)
- Penghasilan → `penghasilan`
- NPWP → `has_npwp`
- Limit Kredit → `limit_amount`
- DP → `dp_amount`
- Tenor → `tenor`
- Tipe HP → `phone_type_id` (mapping dari nama seri)

### Mapping yang Perlu Dilakukan

1. **Nama Promotor** → `users.id` (cari berdasarkan nama/email)
2. **Nama Toko** → `stores.id` (cari berdasarkan nama toko)
3. **Tipe HP** → `phone_types.id` (cari berdasarkan nama seri)
4. **Pekerjaan** → pastikan sesuai constraint enum

### Timezone
⚠️ **PENTING**: Database menggunakan timezone **Asia/Makassar (WITA, UTC+8)**

Saat insert data:
```sql
-- Gunakan format ini
created_at = '2024-12-01 10:00:00+08'
-- ATAU
created_at = TIMESTAMP '2024-12-01 10:00:00' AT TIME ZONE 'Asia/Makassar'
```

---

## ✅ STATUS DOKUMENTASI

- ✅ Tabel `vast_finance_data_new` - **LENGKAP**
- ✅ Tabel `stores` - **LENGKAP**
- ✅ Tabel `users` - **LENGKAP**
- ✅ Tabel `phone_types` - **LENGKAP**
- ✅ Tabel `hierarchy` - **LENGKAP**
- ⚠️ Tabel `conversions` - **BELUM DETAIL**
- ⚠️ Tabel `targets` - **BELUM DETAIL**
- ⚠️ Tabel agregasi - **BELUM DETAIL**

---

## 🔄 UPDATE LOG

| Tanggal | Perubahan |
|---------|-----------|
| 2024-12-26 | Dokumentasi awal dibuat berdasarkan cek langsung ke database production |

---

**END OF DOCUMENT**
