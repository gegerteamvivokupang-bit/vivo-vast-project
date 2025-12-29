-- ============================================================================
-- COMPREHENSIVE CHECK: HIERARCHY & DATA INTEGRITY
-- ============================================================================

-- 1. CEK USER ORPHAN (tidak ada di hierarchy)
SELECT 
    '1. USER ORPHAN (No Hierarchy)' as check_name,
    u.name,
    u.role,
    u.status,
    s.name as toko,
    COUNT(vfdn.id) as data_records
FROM users u
LEFT JOIN hierarchy h ON h.user_id = u.id
LEFT JOIN stores s ON s.id = u.store_id
LEFT JOIN vast_finance_data_new vfdn ON vfdn.created_by_user_id = u.id
WHERE u.role IN ('promotor', 'sator', 'spv')
  AND u.status = 'active'
  AND h.user_id IS NULL
GROUP BY u.name, u.role, u.status, s.name
ORDER BY data_records DESC;

-- Expected: 0 rows (semua user harus ada di hierarchy)

-- ============================================================================

-- 2. CEK HIERARCHY DENGAN ATASAN INVALID (atasan_id tidak exist)
SELECT 
    '2. INVALID ATASAN' as check_name,
    u.name as user_name,
    u.role,
    h.atasan_id,
    'Atasan tidak ditemukan' as issue
FROM hierarchy h
JOIN users u ON u.id = h.user_id
LEFT JOIN users atasan ON atasan.id = h.atasan_id
WHERE h.atasan_id IS NOT NULL
  AND atasan.id IS NULL;

-- Expected: 0 rows (semua atasan_id harus valid)

-- ============================================================================

-- 3. CEK HIERARCHY DENGAN STORE INVALID (store_id tidak exist)
SELECT 
    '3. INVALID STORE' as check_name,
    u.name as user_name,
    u.role,
    h.store_id,
    'Store tidak ditemukan' as issue
FROM hierarchy h
JOIN users u ON u.id = h.user_id
LEFT JOIN stores s ON s.id = h.store_id
WHERE h.store_id IS NOT NULL
  AND s.id IS NULL;

-- Expected: 0 rows (semua store_id harus valid)

-- ============================================================================

-- 4. CEK PROMOTOR TANPA ATASAN (harus punya SATOR atau SPV)
SELECT 
    '4. PROMOTOR WITHOUT ATASAN' as check_name,
    u.name,
    h.store_id,
    s.name as toko,
    COUNT(vfdn.id) as data_records
FROM hierarchy h
JOIN users u ON u.id = h.user_id
LEFT JOIN stores s ON s.id = h.store_id
LEFT JOIN vast_finance_data_new vfdn ON vfdn.created_by_user_id = u.id
WHERE u.role = 'promotor'
  AND u.status = 'active'
  AND h.atasan_id IS NULL
GROUP BY u.name, h.store_id, s.name
ORDER BY data_records DESC;

-- Expected: 0 rows (semua promotor harus punya atasan)

-- ============================================================================

-- 5. CEK SATOR DENGAN ATASAN BUKAN SPV
SELECT 
    '5. SATOR WITH INVALID ATASAN ROLE' as check_name,
    u.name as sator_name,
    atasan.name as atasan_name,
    atasan.role as atasan_role,
    'Atasan harus SPV' as issue
FROM hierarchy h
JOIN users u ON u.id = h.user_id
JOIN users atasan ON atasan.id = h.atasan_id
WHERE u.role = 'sator'
  AND u.status = 'active'
  AND atasan.role != 'spv';

-- Expected: 0 rows (SATOR harus di bawah SPV)

-- ============================================================================

-- 6. CEK PROMOTOR DENGAN ATASAN BUKAN SATOR/SPV
SELECT 
    '6. PROMOTOR WITH INVALID ATASAN ROLE' as check_name,
    u.name as promotor_name,
    atasan.name as atasan_name,
    atasan.role as atasan_role,
    'Atasan harus SATOR atau SPV' as issue
FROM hierarchy h
JOIN users u ON u.id = h.user_id
JOIN users atasan ON atasan.id = h.atasan_id
WHERE u.role = 'promotor'
  AND u.status = 'active'
  AND atasan.role NOT IN ('sator', 'spv');

-- Expected: 0 rows (Promotor harus di bawah SATOR/SPV)

-- ============================================================================

--7. CEK USER DENGAN store_id INVALID di tabel users
SELECT 
    '7. USER WITH INVALID STORE_ID' as check_name,
    u.name,
    u.role,
    u.store_id,
    'Store tidak ditemukan' as issue
FROM users u
LEFT JOIN stores s ON s.id = u.store_id
WHERE u.role IN ('promotor', 'sator', 'spv')
  AND u.status = 'active'
  AND u.store_id IS NOT NULL
  AND s.id IS NULL;

-- Expected: 0 rows (semua store_id di users harus valid)

-- ============================================================================

-- 8. CEK DATA vfdn DENGAN created_by_user_id INVALID
SELECT 
    '8. DATA WITH INVALID USER' as check_name,
    vfdn.created_by_user_id,
    COUNT(*) as record_count,
    'User tidak ditemukan' as issue
FROM vast_finance_data_new vfdn
LEFT JOIN users u ON u.id = vfdn.created_by_user_id
WHERE vfdn.source = 'excel'
  AND u.id IS NULL
GROUP BY vfdn.created_by_user_id;

-- Expected: 0 rows (semua user harus exist)

-- ============================================================================

-- 9. CEK DATA vfdn DENGAN store_id INVALID
SELECT 
    '9. DATA WITH INVALID STORE' as check_name,
    vfdn.store_id,
    COUNT(*) as record_count,
    'Store tidak ditemukan' as issue
FROM vast_finance_data_new vfdn
LEFT JOIN stores s ON s.id = vfdn.store_id
WHERE vfdn.source = 'excel'
  AND s.id IS NULL
GROUP BY vfdn.store_id;

-- Expected: 0 rows (semua store harus exist)

-- ============================================================================

-- 10. CEK STORE_ID MISMATCH (users.store_id != hierarchy.store_id)
SELECT 
    '10. STORE_ID MISMATCH' as check_name,
    u.name,
    u.role,
    us.name as user_store,
    hs.name as hierarchy_store,
    'Store tidak konsisten' as issue
FROM users u
JOIN hierarchy h ON h.user_id = u.id
LEFT JOIN stores us ON us.id = u.store_id
LEFT JOIN stores hs ON hs.id = h.store_id
WHERE u.role IN ('promotor', 'sator')
  AND u.status = 'active'
  AND u.store_id IS NOT NULL
  AND h.store_id IS NOT NULL
  AND u.store_id != h.store_id;

-- Expected: 0 rows (store_id harus sama)

-- ============================================================================

-- 11. SUMMARY: HIERARCHY HEALTH CHECK
SELECT 
    '=== HIERARCHY HEALTH SUMMARY ===' as summary,
    COUNT(DISTINCT CASE WHEN u.role = 'promotor' THEN u.id END) as total_promotor,
    COUNT(DISTINCT CASE WHEN u.role = 'sator' THEN u.id END) as total_sator,
    COUNT(DISTINCT CASE WHEN u.role = 'spv' THEN u.id END) as total_spv,
    COUNT(DISTINCT h.user_id) as total_in_hierarchy,
    COUNT(DISTINCT CASE WHEN u.role IN ('promotor', 'sator', 'spv') AND h.user_id IS NULL THEN u.id END) as orphan_users,
    CASE 
        WHEN COUNT(DISTINCT CASE WHEN u.role IN ('promotor', 'sator', 'spv') AND h.user_id IS NULL THEN u.id END) = 0
        THEN '✅ ALL USERS IN HIERARCHY'
        ELSE '❌ HAS ORPHAN USERS'
    END as status
FROM users u
LEFT JOIN hierarchy h ON h.user_id = u.id
WHERE u.status = 'active';

-- ============================================================================

-- 12. DETAIL HIERARCHY STRUKTUR (sample 10 promotor)
SELECT 
    'HIERARCHY SAMPLE' as section,
    u.name as promotor,
    s.name as toko,
    atasan.name as sator_atau_spv,
    atasan.role as atasan_role,
    spv.name as spv_name,
    h.area
FROM users u
JOIN hierarchy h ON h.user_id = u.id
LEFT JOIN stores s ON s.id = h.store_id
LEFT JOIN users atasan ON atasan.id = h.atasan_id
LEFT JOIN hierarchy h2 ON h2.user_id = atasan.id AND atasan.role = 'sator'
LEFT JOIN users spv ON spv.id = h2.atasan_id
WHERE u.role = 'promotor'
  AND u.status = 'active'
ORDER BY RANDOM()
LIMIT 10;

-- ============================================================================

-- 13. CEK DATA INTEGRITY: Promotor punya data tapi tidak di hierarchy
SELECT 
    '13. DATA WITHOUT HIERARCHY' as check_name,
    u.name as promotor,
    COUNT(vfdn.id) as total_data,
    'User punya data tapi tidak di hierarchy' as issue
FROM vast_finance_data_new vfdn
JOIN users u ON u.id = vfdn.created_by_user_id
LEFT JOIN hierarchy h ON h.user_id = u.id
WHERE vfdn.source = 'excel'
  AND h.user_id IS NULL
GROUP BY u.name
ORDER BY total_data DESC;

-- Expected: 0 rows (semua user dengan data harus di hierarchy)
