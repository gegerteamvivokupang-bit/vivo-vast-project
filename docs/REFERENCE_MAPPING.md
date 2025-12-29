# REFERENCE MAPPING - PROMOTOR, TOKO, TIPE HP
**Updated: 26 Desember 2024**

> 📌 Dokumen ini berisi mapping UUID untuk migrasi data  
> Copy-paste UUID ini saat membuat SQL INSERT

---

## 👥 MAPPING PROMOTOR

**Format**: `Nama Promotor` → `UUID` (Toko)

| Nama Promotor | UUID | Toko | Email |
|---------------|------|------|-------|
| ADRIANA | `9b2e793b-e1b8-45ec-a2ba-fc5c57059742` | MUTIARA CELL | adriana@vast.com |
| AINI RAHMATINI NATALIA MOESTAKIM | `218f4692-3309-4fc5-bab0-8bd119af7b7e` | PAKARENA | aini@vast.com |
| ALDIANA WELIA PANIE | `067c47ba-9638-4b56-add4-3c59d9ec328a` | - | aldiana@vast.com |
| ALITA D PAU | `44e3bdda-3da6-444f-bd32-f01d869bbc3b` | - | alita@vast.com |
| AMBU BAIQ JUMENAH | `0fca68bb-4445-4043-b851-50a405d54901` | - | ambu@vast.com |
| ANAK AGUNG SRI WULANTIWI | `65b22826-5c27-4ff8-8276-bbc664f2e8f0` | - | anak.agung@vast.com |
| ANDHIKA ULLY | `d87b788c-b59a-4994-abdd-b94a34188b46` | - | andhika@vast.com |
| ANGELA BOUKA BERI | `08dac9ab-85ac-4906-81c2-da9bf30b817c` | - | angela@vast.com |
| ANITA ANA AMAH | `328d11fd-74c1-4fd8-a788-722ab3b51885` | - | anita@vast.com |
| ANNA RAHMATIA JUFRI | `cabd42dc-048d-46c3-bfa5-13f75a894689` | BEST GADGET | anna@vast.com |
| ANYARMITHA SOPHIA SUEK | `a5a7fb67-2524-47d9-819f-c8f3dfde398a` | - | anyarmitha@vast.com |
| ARMINDA TEKU MANEK | `d0d4a13e-6c5c-4d2f-8eb5-ab93654cdcd6` | - | arminda@vast.com |
| ASRI NINGSI RAMBU ATA ENDI | `cba59c3e-56b1-4953-b328-0edeceaaca9d` | - | asri@vast.com |
| ASTUTI BELA WAWO | `0ee3305f-60e7-48e3-b6c6-88161be113b8` | - | astuti@vast.com |
| AZ ZAHRA SITI ZAINAB | `6b72905b-a553-4f12-8d40-730237dbd13e` | - | az.zahra@vast.com |
| BERGITHA NIA OLIN | `7232802a-727e-40da-ab08-c891177fd1b0` | INFINITY CELL | bergitha@vast.com |
| CHOIRUNISA ILHAM | `ad58a293-fa8b-4554-810d-d488e290427d` | - | choirunisa@vast.com |
| DEWI RAHMAN | `f6a85c85-8f61-4aec-9c44-df5958f9220c` | - | dewi@vast.com |
| DWITNEY PRETY WANGGANDIMA | `03202fc3-fbb7-4e7c-8964-22a29c144a01` | - | dwitney@vast.com |
| EMPI FRANGKI LIEM | `59529ff7-2e5a-4ce6-b4a6-a657521f8d75` | - | empi@vast.com |

> ⚠️ **Catatan**: Daftar di atas hanya 20 promotor pertama. Ada lebih banyak promotor di database.  
> Untuk mendapatkan full list, jalankan query berikut di Supabase:

```sql
SELECT 
    u.name AS nama_promotor,
    u.id AS uuid,
    s.name AS nama_toko,
    u.email
FROM users u
LEFT JOIN stores s ON s.id = u.store_id
WHERE u.role = 'promotor' 
    AND u.status = 'active'
ORDER BY u.name;
```

---

## 🏪 MAPPING TOKO

**Format**: `Nama Toko` → `UUID`

| Nama Toko | UUID | Area |
|-----------|------|------|
| ANDYS CELL | `c67687dd-043b-4d91-a2ab-81cd6730effd` | KABUPATEN |
| BEST GADGET | `0ffc3891-c7b1-4988-80d2-14ed3c3090e6` | KABUPATEN |
| FATIMA CELL | `530afbb8-6e7a-4b9d-bc6a-16847c01c23d` | KABUPATEN |
| GARUDA CELL | `30b2dbb6-50f9-4888-a331-d53efd9fac1b` | KABUPATEN |
| INFINITY CELL | `fbcd4eec-cf39-485c-86e1-2c9103d04cd2` | KABUPATEN |
| KERSEN CELL | `6b24681c-c352-4bd1-a27f-05309a85efa2` | KABUPATEN |
| MARIA | `35bbdd95-49cb-4e4f-987a-de5cb86c604c` | KABUPATEN |
| MUTIARA CELL | `89cca833-3a3d-4c35-bb28-352eaeacd4a6` | KABUPATEN |
| NABILA CELL | `c0f644e4-aba2-4565-b038-71da7db6b976` | KABUPATEN |
| PAKARENA | `dc1202cb-f67c-4b78-9666-beada1b46e4f` | KABUPATEN |

> 💡 **Tips**: Untuk mendapatkan full list toko, jalankan:

```sql
SELECT name, id, area, is_spc
FROM stores
WHERE is_active = true
ORDER BY name;
```

---

## 📱 MAPPING TIPE HP

**Format**: `Nama Seri` → `UUID`

| Nama Seri | UUID |
|-----------|------|
| IQOO Series | `402297b5-8f4e-43c6-b9e4-354182df4adc` |
| V60 Series | `bd74b84f-9a0f-4ca9-9444-3828635e3aa7` |
| X Series | `7bee4b48-e53e-4d26-bf4d-11ab4592d7d6` |
| Y04 Series | `0bf7ca3e-7cab-462f-9076-9bca67a67fb6` |
| Y21d Series | `ccd53aa2-13d7-48e1-a849-4eea47b91af1` |
| Y400 Series | `c28af8e6-7c48-4d7c-acc4-2aa549b50eea` |

> ✅ **Semua tipe HP di atas sudah lengkap** (hanya 6 tipe yang tersedia)

```sql
-- Query untuk cek tipe HP
SELECT name, id
FROM phone_types
WHERE is_active = true
ORDER BY name;
```

---

## 📖 MAPPING PEKERJAAN

**HARUS sesuai dengan nilai berikut** (case-sensitive):

| No | Nilai Valid |
|----|-------------|
| 1 | Karyawan Swasta |
| 2 | PNS/ASN |
| 3 | Wiraswasta |
| 4 | TNI/Polri |
| 5 | Pensiunan |
| 6 | Tidak Bekerja |
| 7 | Lainnya |

❌ **SALAH**:
- "Swasta"
- "Karyawan"
- "PNS"
- "pegawai swasta"

✅ **BENAR**:
- "Karyawan Swasta"
- "PNS/ASN"
- "Wiraswasta"

---

## 📖 MAPPING STATUS

| Status Excel | Kolom `status` | Kolom `approval_status` | Kolom `transaction_status` | Arti |
|--------------|----------------|------------------------|----------------------------|------|
| ACC | `acc` | `approved` | `closed` | Kredit approved + customer sudah ambil HP |
| PENDING | `pending` | `approved` | `not_closed` | Kredit approved + customer belum ambil HP |
| REJECT | `reject` | `rejected` | `not_closed` | Kredit ditolak |

---

## 🔧 CONTOH PENGGUNAAN

### Contoh SQL INSERT (1 record)

```sql
INSERT INTO vast_finance_data_new (
    created_by_user_id,
    store_id,
    sale_date,
    customer_name,
    customer_phone,
    pekerjaan,
    penghasilan,
    has_npwp,
    status,
    limit_amount,
    dp_amount,
    tenor,
    phone_type_id,
    approval_status,
    transaction_status,
    source,
    created_at
) VALUES (
    -- Promotor: AINI RAHMATINI NATALIA MOESTAKIM
    '218f4692-3309-4fc5-bab0-8bd119af7b7e',
    
    -- Toko: PAKARENA
    'dc1202cb-f67c-4b78-9666-beada1b46e4f',
    
    -- Tanggal penjualan
    '2024-12-15',
    
    -- Data customer
    'Budi Santoso',
    '+6281234567890',
    'Karyawan Swasta',
    5000000,
    true,
    
    -- Status (ACC)
    'acc',
    4000000,
    500000,
    12,
    
    -- Tipe HP: Y21d Series
    'ccd53aa2-13d7-48e1-a849-4eea47b91af1',
    
    -- Approval & Transaction Status
    'approved',
    'closed',
    
    -- Source & timestamp
    'migration_excel',
    TIMESTAMP '2024-12-15 10:00:00' AT TIME ZONE 'Asia/Makassar'
);
```

### Contoh Batch INSERT (Multiple Records)

```sql
INSERT INTO vast_finance_data_new (
    created_by_user_id, store_id, sale_date, customer_name, 
    customer_phone, pekerjaan, status, approval_status, 
    transaction_status, source, created_at
) VALUES
-- Record 1: ACC
('218f4692-3309-4fc5-bab0-8bd119af7b7e', 'dc1202cb-f67c-4b78-9666-beada1b46e4f', 
 '2024-12-01', 'Customer 1', '+6281111111111', 'Karyawan Swasta', 
 'acc', 'approved', 'closed', 'migration_excel', 
 TIMESTAMP '2024-12-01 09:00:00' AT TIME ZONE 'Asia/Makassar'),

-- Record 2: PENDING
('218f4692-3309-4fc5-bab0-8bd119af7b7e', 'dc1202cb-f67c-4b78-9666-beada1b46e4f', 
 '2024-12-02', 'Customer 2', '+6281222222222', 'Wiraswasta', 
 'pending', 'approved', 'not_closed', 'migration_excel', 
 TIMESTAMP '2024-12-02 10:00:00' AT TIME ZONE 'Asia/Makassar'),

-- Record 3: REJECT
('9b2e793b-e1b8-45ec-a2ba-fc5c57059742', '89cca833-3a3d-4c35-bb28-352eaeacd4a6', 
 '2024-12-03', 'Customer 3', '+6281333333333', 'PNS/ASN', 
 'reject', 'rejected', 'not_closed', 'migration_excel', 
 TIMESTAMP '2024-12-03 11:00:00' AT TIME ZONE 'Asia/Makassar');
```

---

## 🔍 TIPS MAPPING

### Jika Nama Promotor di Excel Berbeda

Gunakan query fuzzy matching:

```sql
SELECT name, id, email
FROM users
WHERE role = 'promotor' 
    AND status = 'active'
    AND name ILIKE '%AINI%'  -- Ganti dengan keyword yang dicari
ORDER BY name;
```

### Jika Nama Toko di Excel Singkatan

```sql
SELECT name, id
FROM stores
WHERE is_active = true
    AND name ILIKE '%PAKAR%'  -- Ganti dengan keyword yang dicari
ORDER BY name;
```

---

**END OF REFERENCE**
