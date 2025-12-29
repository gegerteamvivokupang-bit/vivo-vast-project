-- ============================================================================
-- UPDATE EMAIL CHESIA ALBERTI BALIK (lebih simple)
-- ============================================================================

UPDATE users
SET email = 'chesia@vast.com'
WHERE id = '00245452-1cbb-407c-8b4f-f0dc76380174';

-- Verify
SELECT id, name, email, store_id
FROM users
WHERE name = 'CHESIA ALBERTI BALIK';

-- ============================================================================
-- Jika perlu update DINDA juga (opsional)
-- ============================================================================

-- UPDATE users
-- SET email = 'dinda@vast.com'
-- WHERE id = '185acbd0-5361-47cd-83d4-da4750c80c58';
