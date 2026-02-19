-- ============================================================================
-- CHECK USER LOGIN ISSUE: DINDA CHRISTANTI
-- Error: "Email atau PIN salah"
-- ============================================================================
-- Dijalankan: 2026-01-05
-- ============================================================================

-- ============================================================================
-- STEP 1: Cek apakah user ada di tabel users
-- ============================================================================
SELECT 
    id,
    email,
    name,
    employee_id,
    role,
    status,
    pin_hash,
    store_id,
    created_at
FROM users
WHERE 
    LOWER(name) LIKE '%dinda%christanti%'
    OR LOWER(email) LIKE '%dinda%'
    OR name = 'DINDA CHRISTANTI';

-- ============================================================================
-- STEP 2: Cek apakah user ada di auth.users (Supabase Auth)
-- ============================================================================
-- PENTING: User harus ada di auth.users untuk bisa login dengan Supabase Auth
-- ============================================================================
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    last_sign_in_at
FROM auth.users
WHERE 
    LOWER(email) LIKE '%dinda%';

-- ============================================================================
-- STEP 3: Cek semua user dengan role promotor (untuk referensi)
-- ============================================================================
SELECT 
    u.id as user_id,
    u.email,
    u.name,
    u.role,
    u.status,
    u.pin_hash,
    s.name as store_name,
    CASE WHEN au.id IS NOT NULL THEN 'YES' ELSE 'NO' END as auth_user_exists
FROM users u
LEFT JOIN stores s ON s.id = u.store_id
LEFT JOIN auth.users au ON au.email = u.email
WHERE u.role = 'promotor'
ORDER BY u.name;

-- ============================================================================
-- KEMUNGKINAN MASALAH:
-- ============================================================================
-- 1. User TIDAK ADA di tabel users
--    → Solusi: INSERT user baru ke tabel users
--
-- 2. User ada di tabel users TAPI TIDAK ADA di auth.users
--    → Solusi: Perlu create user di auth.users dengan email yang sama
--    → Password di auth.users harus = email (sesuai sistem)
--
-- 3. User ada tapi STATUS = 'inactive'
--    → Solusi: UPDATE status menjadi 'active'
--
-- 4. PIN_HASH kosong atau NULL
--    → Solusi: UPDATE pin_hash dengan PIN baru
--
-- 5. Email BERBEDA di users vs auth.users
--    → Solusi: Pastikan email sama persis
-- ============================================================================

-- ============================================================================
-- FIX: Jika user ada di users tapi tidak di auth.users
-- ============================================================================
-- Jalankan di Supabase Dashboard → SQL Editor:
/*
-- 1. Cari email user dari tabel users
SELECT email FROM users WHERE LOWER(name) LIKE '%dinda%christanti%';

-- 2. Create user di auth.users (ganti email sesuai hasil step 1)
-- Jalankan via Supabase Auth API atau Admin Dashboard
-- Password = email (sesuai sistem login)
*/

-- ============================================================================
-- FIX: Jika pin_hash NULL atau salah
-- ============================================================================
/*
UPDATE users 
SET pin_hash = '123456'  -- Ganti dengan PIN yang benar
WHERE LOWER(name) LIKE '%dinda%christanti%';
*/

-- ============================================================================
-- FIX: Jika status inactive
-- ============================================================================
/*
UPDATE users 
SET status = 'active'
WHERE LOWER(name) LIKE '%dinda%christanti%';
*/
