-- ============================================================================
-- INVESTIGASI: Dashboard hanya tampil 942 dari 965 records
-- ============================================================================

-- 1. CEK SOFT DELETE (deleted_at)
SELECT 
    'Soft Delete Check' as check_item,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE deleted_at IS NULL) as active_records,
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted_records,
    CASE 
        WHEN COUNT(*) FILTER (WHERE deleted_at IS NULL) = 942
        THEN '⚠️ 23 records are SOFT DELETED'
        ELSE 'Check other causes'
    END as diagnosis
FROM vast_finance_data_new
WHERE source = 'excel';

-- 2. CEK DISTRIBUSI deleted_at
SELECT 
    CASE 
        WHEN deleted_at IS NULL THEN 'Active (deleted_at = NULL)'
        ELSE 'Soft Deleted (deleted_at NOT NULL)'
    END as record_status,
    COUNT(*) as count
FROM vast_finance_data_new
WHERE source = 'excel'
GROUP BY deleted_at IS NULL
ORDER BY deleted_at IS NULL DESC;

-- 3. CEK 23 RECORDS YANG KEMUNGKINAN SOFT DELETED
SELECT 
    vfdn.sale_date,
    vfdn.customer_name,
    vfdn.status,
    vfdn.deleted_at,
    u.name as promotor,
    s.name as toko
FROM vast_finance_data_new vfdn
LEFT JOIN users u ON u.id = vfdn.created_by_user_id
LEFT JOIN stores s ON s.id = vfdn.store_id
WHERE vfdn.source = 'excel'
  AND vfdn.deleted_at IS NOT NULL
ORDER BY vfdn.deleted_at DESC;

-- 4. CEK CREATED_AT vs UPDATED_AT
SELECT 
    'Timestamp Check' as check_item,
    COUNT(*) as total,
    MIN(created_at) as earliest_created,
    MAX(created_at) as latest_created,
    COUNT(DISTINCT DATE(created_at)) as unique_creation_dates
FROM vast_finance_data_new
WHERE source = 'excel';

-- 5. CEK APAKAH ADA FILTER STATUS DI DASHBOARD
SELECT 
    vfdn.status,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE vfdn.deleted_at IS NULL) as active
FROM vast_finance_data_new vfdn
WHERE vfdn.source = 'excel'
GROUP BY vfdn.status
ORDER BY vfdn.status;

-- 6. CEK PROMOTOR YANG DATANYA MUNGKIN TER-FILTER
SELECT 
    u.name as promotor,
    u.status as user_status,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE vfdn.deleted_at IS NULL) as active_records,
    COUNT(*) FILTER (WHERE vfdn.deleted_at IS NOT NULL) as deleted_records
FROM vast_finance_data_new vfdn
JOIN users u ON u.id = vfdn.created_by_user_id
WHERE vfdn.source = 'excel'
GROUP BY u.name, u.status
HAVING COUNT(*) FILTER (WHERE vfdn.deleted_at IS NOT NULL) > 0
ORDER BY deleted_records DESC;

-- 7. SOLUTION: UPDATE deleted_at jadi NULL (jika memang soft deleted)
-- UNCOMMENT jika mau fix:
-- UPDATE vast_finance_data_new
-- SET deleted_at = NULL
-- WHERE source = 'excel' AND deleted_at IS NOT NULL;

-- 8. CEK TOTAL SETELAH deleted_at = NULL
SELECT 
    'Active Records' as item,
    COUNT(*) FILTER (WHERE deleted_at IS NULL) as count,
    CASE 
        WHEN COUNT(*) FILTER (WHERE deleted_at IS NULL) = 965
        THEN '✅ ALL ACTIVE'
        ELSE '⚠️ STILL HAVE SOFT DELETED'
    END as status
FROM vast_finance_data_new
WHERE source = 'excel';
