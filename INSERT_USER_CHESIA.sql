-- ============================================================================
-- INSERT USER BARU: CHESIA ALBERTI BALIK
-- Promotor di ANDYS CELL
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
    gen_random_uuid(),
    'chesia.alberti.balik@vast.com',               -- Email
    'CHESIA ALBERTI BALIK',                        -- Nama (UPPERCASE sesuai standar)
    'CHE001',                                      -- Employee ID
    'promotor',                                     -- Role
    'active',                                       -- Status
    'c67687dd-043b-4d91-a2ab-81cd6730effd',        -- Store ID: ANDYS CELL
    NOW(),
    NOW()
) RETURNING id, name, email, store_id;

-- ============================================================================
-- SETELAH INSERT:
-- ============================================================================

-- 1. Verify user sudah masuk
SELECT id, name, email, store_id, role, status
FROM users
WHERE name = 'CHESIA ALBERTI BALIK';

-- 2. COPY UUID yang di-return dan berikan ke AI untuk update mapping
