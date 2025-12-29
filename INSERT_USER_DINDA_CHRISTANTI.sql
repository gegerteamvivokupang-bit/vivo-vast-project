-- ============================================================================
-- INSERT USER BARU: DINDA CHRISTANTI
-- Promotor di SPC ATAMBUA
-- ============================================================================

-- INSERT ke tabel users
INSERT INTO users (
    id,
    email,
    name,
    employee_id,
    role,
    status,
    store_id,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),                              -- ID akan di-generate otomatis
    'dinda.christanti@vast.com',                    -- Email
    'DINDA CHRISTANTI',                             -- Nama (UPPERCASE sesuai standar)
    'DIN001',                                       -- Employee ID
    'promotor',                                     -- Role
    'active',                                       -- Status
    '09f655e6-cbc7-4730-9301-acb2ee2ea7ff',        -- Store ID: SPC ATAMBUA
    NOW(),                                          -- Created at
    NOW()                                           -- Updated at
) RETURNING id, name, email, store_id;

-- ⚠️ CATATAN PENTING:
-- 1. Setelah execute, COPY UUID yang di-return (kolom 'id')
-- 2. Berikan UUID tersebut ke saya untuk update mapping
-- 3. Atau jika mau manual set UUID, ganti gen_random_uuid() dengan UUID spesifik

-- ============================================================================
-- ALTERNATIF: Jika mau set UUID manual
-- ============================================================================

-- INSERT INTO users (
--     id,
--     email,
--     name,
--     employee_id,
--     phone,
--     role,
--     status,
--     store_id,
--     created_at,
--     updated_at
-- ) VALUES (
--     'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',     -- UUID yang Anda tentukan
--     'dinda.christanti@vast.com',
--     'DINDA CHRISTANTI',
--     'DIN001',
--     '+62812XXXXXXXX',
--     'promotor',
--     'active',
--     '09f655e6-cbc7-4730-9301-acb2ee2ea7ff',
--     NOW(),
--     NOW()
-- );

-- ============================================================================
-- SETELAH INSERT:
-- ============================================================================

-- 1. Verify user sudah masuk
SELECT id, name, email, store_id, role, status
FROM users
WHERE name = 'DINDA CHRISTANTI';

-- 2. Cek hierarchy - pastikan DINDA ter-link ke SATOR/SPV/Manager
SELECT 
    u.name as promotor,
    u.store_id,
    s.name as nama_toko,
    h.atasan_id
FROM users u
LEFT JOIN stores s ON s.id = u.store_id
LEFT JOIN hierarchy h ON h.user_id = u.id
WHERE u.name = 'DINDA CHRISTANTI';

-- 3. Jika hierarchy belum ada, insert ke tabel hierarchy
-- INSERT INTO hierarchy (id, user_id, atasan_id, store_id, area, created_at, updated_at)
-- VALUES (
--     gen_random_uuid(),
--     'UUID-DINDA',                                   -- UUID DINDA yang baru di-insert
--     'UUID-SATOR',                                   -- UUID SATOR yang membawahi
--     '09f655e6-cbc7-4730-9301-acb2ee2ea7ff',        -- Store: SPC ATAMBUA
--     NULL,
--     NOW(),
--     NOW()
-- );

-- ============================================================================
-- INFORMASI TAMBAHAN:
-- ============================================================================

-- DINDA CHRISTANTI memiliki:
-- - 19 pengajuan di bulan Desember 2025
-- - Mayoritas status ACC (closing)
-- - Toko: SPC ATAMBUA (area: KABUPATEN)

-- Pastikan juga:
-- 1. PIN/Password untuk login (jika pakai auth)
-- 2. Hierarchy ke atasan (SATOR/SPV)
-- 3. Target bulanan (jika ada)
