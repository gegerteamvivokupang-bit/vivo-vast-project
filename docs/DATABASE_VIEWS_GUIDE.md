# DATABASE VIEWS GUIDE
## VAST FINANCE - Panduan Struktur View Agregat

Dokumen ini menjelaskan struktur view di database untuk agregasi data.
**WAJIB DIBACA** sebelum mengerjakan fitur dashboard/report.

---

## 1. HIRARKI ORGANISASI

```
MANAGER AREA
    │
    ▼
   SPV (Supervisor)
    │
    ▼
  SATOR (Sales Coordinator)
    │
    ▼
 PROMOTOR
```

### Catatan Khusus
- **Anfal & Wilibroddus** adalah SPV yang juga bertindak sebagai SATOR
- Mereka membawahi SATOR lain, sekaligus punya PROMOTOR langsung

---

## 2. TABEL DASAR

### 2.1 Tabel `hierarchy`
Menyimpan hubungan atasan-bawahan.

| Field | Tipe | Keterangan |
|-------|------|------------|
| user_id | UUID | ID user (bawahan) |
| atasan_id | UUID | ID atasan langsung |
| area | TEXT | Nama area |
| store_id | UUID | ID toko (untuk promotor) |

### 2.2 Tabel `users`
Menyimpan data user.

| Field | Tipe | Keterangan |
|-------|------|------------|
| id | UUID | ID user |
| name | TEXT | Nama lengkap |
| role | TEXT | Role: promotor, sator, spv, manager, admin |

---

## 3. VIEW AGREGAT - STRUKTUR BERLAPIS

View disusun berlapis dari level terendah ke tertinggi:

```
┌─────────────────────────────────────────────────────────────┐
│  LEVEL 0: DATA TRANSAKSI MENTAH                            │
│  - vast_finance_data_new (transaksi baru)                  │
│  - vast_finance_data_old (transaksi historis)              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  LEVEL 1: AGREGAT PER PROMOTOR                             │
│  - v_agg_daily_promoter_all (harian)                       │
│  - v_agg_monthly_promoter_all (bulanan)                    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼ SUM per atasan_id
┌─────────────────────────────────────────────────────────────┐
│  LEVEL 2: AGREGAT PER SATOR                                │
│  - v_agg_daily_sator_all (harian)                          │
│  - v_agg_monthly_sator_all (bulanan)                       │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼ SUM per atasan_id
┌─────────────────────────────────────────────────────────────┐
│  LEVEL 3: AGREGAT PER SPV                                  │
│  - v_agg_daily_spv_all (harian)                            │
│  - v_agg_monthly_spv_all (bulanan)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. DETAIL VIEW

### 4.1 View Promotor (Level 1)

**v_agg_daily_promoter_all**
```sql
SELECT
    promoter_user_id,    -- ID promotor
    agg_date,            -- Tanggal (YYYY-MM-DD)
    total_input,         -- Jumlah pengajuan
    total_approved,      -- Disetujui
    total_rejected,      -- Ditolak
    total_closed,        -- Closing (ACC)
    total_pending,       -- Pending
    total_closing_direct,
    total_closing_followup
FROM v_agg_daily_promoter_all
```

**v_agg_monthly_promoter_all**
```sql
-- Sama dengan daily, tapi field tanggal = agg_month (YYYY-MM-01)
```

---

### 4.2 View Sator (Level 2)

**v_agg_monthly_sator_all**
```sql
SELECT
    sator_user_id,       -- ID sator (atasan promotor)
    agg_month,           -- Bulan (YYYY-MM-01)
    total_input,         -- SUM dari semua promotor
    total_approved,
    total_rejected,
    total_closed,
    total_pending,
    total_closing_direct,
    total_closing_followup,
    promotor_count       -- Jumlah promotor di bawahnya
FROM v_agg_monthly_sator_all
```

**Cara kerja:**
- JOIN hierarchy ON user_id = promoter_user_id
- GROUP BY atasan_id
- SUM semua field agregat

---

### 4.3 View SPV (Level 3)

**v_agg_monthly_spv_all**
```sql
SELECT
    spv_user_id,         -- ID SPV (atasan sator)
    agg_month,           -- Bulan (YYYY-MM-01)
    total_input,         -- SUM dari semua sator
    total_approved,
    total_rejected,
    total_closed,
    total_pending,
    total_closing_direct,
    total_closing_followup,
    sator_count          -- Jumlah sator di bawahnya
FROM v_agg_monthly_spv_all
```

**Cara kerja:**
- Mengambil data dari v_agg_monthly_sator_all
- JOIN hierarchy untuk dapat atasan dari sator
- GROUP BY atasan_id (spv)

---

## 5. CARA PENGGUNAAN PER ROLE

### 5.1 PROMOTOR melihat data sendiri
```sql
SELECT * FROM v_agg_monthly_promoter_all
WHERE promoter_user_id = [current_user_id]
AND agg_month = '2024-12-01'
```

### 5.2 SATOR melihat data promotor
```sql
-- Daftar promotor dan datanya
SELECT * FROM v_agg_monthly_promoter_all
WHERE promoter_user_id IN (
    SELECT user_id FROM hierarchy
    WHERE atasan_id = [sator_user_id]
)
AND agg_month = '2024-12-01'
```

### 5.3 SPV melihat data SATOR
```sql
-- Daftar sator dan agregat datanya
SELECT * FROM v_agg_monthly_sator_all
WHERE sator_user_id IN (
    SELECT user_id FROM hierarchy
    WHERE atasan_id = [spv_user_id]
)
AND agg_month = '2024-12-01'
```

### 5.4 SPV melihat data PROMOTOR (detail)
```sql
-- Semua promotor di bawah semua sator
SELECT * FROM v_agg_monthly_promoter_all
WHERE promoter_user_id IN (
    SELECT h2.user_id FROM hierarchy h2
    WHERE h2.atasan_id IN (
        SELECT h1.user_id FROM hierarchy h1
        WHERE h1.atasan_id = [spv_user_id]
    )
)
AND agg_month = '2024-12-01'
```

### 5.5 MANAGER AREA melihat data SPV
```sql
SELECT * FROM v_agg_monthly_spv_all
WHERE spv_user_id IN (
    SELECT user_id FROM hierarchy
    WHERE area = [area_name]
)
AND agg_month = '2024-12-01'
```

---

## 6. KASUS KHUSUS: SPV + SATOR (Anfal, Wilibroddus)

Mereka punya **dua peran**:
1. Sebagai **SATOR** - punya promotor langsung
2. Sebagai **SPV** - punya sator di bawahnya

### Struktur Contoh (Anfal):
```
Anfal (SPV)
├── Sator Antonio
│   ├── Promotor A
│   └── Promotor B
├── Sator Budi
│   └── Promotor C
└── [Anfal sebagai Sator]
    ├── Promotor D (langsung di bawah Anfal)
    └── Promotor E (langsung di bawah Anfal)
```

### Query untuk Anfal:

**Total sebagai SATOR (promotor D, E):**
```sql
SELECT * FROM v_agg_monthly_sator_all
WHERE sator_user_id = [anfal_id]
```

**Total sebagai SPV (Antonio + Budi):**
```sql
SELECT * FROM v_agg_monthly_spv_all
WHERE spv_user_id = [anfal_id]
```

**Total AREA Anfal (semua):**
```sql
-- Gabungan: data langsung + data dari sator bawahan
SELECT
    SUM(total_input) as total_input,
    ...
FROM (
    -- Data promotor langsung
    SELECT * FROM v_agg_monthly_sator_all
    WHERE sator_user_id = [anfal_id]

    UNION ALL

    -- Data dari sator bawahan
    SELECT * FROM v_agg_monthly_spv_all
    WHERE spv_user_id = [anfal_id]
) combined
WHERE agg_month = '2024-12-01'
```

---

## 7. FIELD METRIK (KONSISTEN DI SEMUA VIEW)

| Field | Keterangan | Tampilan UI |
|-------|------------|-------------|
| total_input | Pengajuan masuk | INPUT |
| total_closed | Closing berhasil | ACC |
| total_pending | Masih proses | PENDING |
| total_rejected | Ditolak | REJECT |
| total_approved | Disetujui | (internal) |
| total_closing_direct | Closing langsung | (detail) |
| total_closing_followup | Closing follow-up | (detail) |

**Catatan:** Di UI gunakan istilah **ACC** (bukan CLOSING).

---

## 8. ATURAN PENTING

1. **JANGAN query tabel transaksi langsung** - selalu gunakan view
2. **View sudah handle data historis** - tidak perlu query terpisah
3. **Filter akses berdasarkan hierarchy** - bukan berdasarkan role
4. **Penjumlahan terjadi di database** - API tinggal query
5. **Field konsisten di semua view** - tidak ada variasi nama

---

## 9. DEPLOY VIEW BARU

Jalankan migration:
```bash
supabase db push
```

Atau manual di Supabase Dashboard:
1. Buka SQL Editor
2. Copy isi file `migrations/20251219_create_sator_spv_views.sql`
3. Run

---

## 10. TROUBLESHOOTING

### View kosong?
- Cek apakah hierarchy terisi dengan benar
- Cek apakah atasan_id tidak NULL

### Data tidak sesuai?
- Pastikan promoter_user_id di view promotor ada di hierarchy
- Cek relasi atasan_id

### Query lambat?
- Tambahkan index pada hierarchy(user_id, atasan_id)
- Tambahkan index pada view (jika materialized)

---

## 11. MAPPING ID LAMA KE BARU

Data lama (`vast_finance_data_old`) punya `promoter_id` yang berbeda dengan `users.id` saat ini.

### Tabel Mapping
```sql
-- Tabel: user_id_mapping_promotor
SELECT old_id, new_id, promoter_name FROM user_id_mapping_promotor;
```

### Cara Kerja di View
View `v_agg_monthly_promoter_all` otomatis mapping ID lama ke baru:
```sql
COALESCE(m.new_id, old.promoter_id) as promoter_user_id
```

- Jika ada mapping → pakai `new_id`
- Jika tidak ada mapping → pakai `old_id` asli

### Menambah Mapping Baru
Jika ada promotor baru yang ID-nya tidak match:
```sql
INSERT INTO user_id_mapping_promotor (old_id, new_id, promoter_name)
VALUES ('uuid-lama', 'uuid-baru', 'Nama Promotor');
```

---

**STATUS: FINAL - SIAP DIGUNAKAN**
