-- ============================================================================
-- CEK RLS POLICY & DASHBOARD QUERY
-- ============================================================================

-- 1. CEK RLS POLICIES untuk vast_finance_data_new
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'vast_finance_data_new'
ORDER BY policyname;

-- 2. CEK apakah ada records dengan created_by_user_id yang tidak valid
SELECT 
    'Invalid User ID Check' as check_item,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE created_by_user_id IN (SELECT id FROM users)) as valid_user,
    COUNT(*) FILTER (WHERE created_by_user_id NOT IN (SELECT id FROM users)) as invalid_user
FROM vast_finance_data_new
WHERE source = 'excel';

-- 3. CEK apakah ada records dengan store_id yang tidak valid
SELECT 
    'Invalid Store ID Check' as check_item,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE store_id IN (SELECT id FROM stores)) as valid_store,
    COUNT(*) FILTER (WHERE store_id NOT IN (SELECT id FROM stores)) as invalid_store
FROM vast_finance_data_new
WHERE source = 'excel';

-- 4. CEK USER STATUS (apakah ada promotor yang inactive)
SELECT 
    u.status as user_status,
    COUNT(*) as record_count
FROM vast_finance_data_new vfdn
JOIN users u ON u.id = vfdn.created_by_user_id
WHERE vfdn.source = 'excel'
GROUP BY u.status;

-- 5. CEK STORE STATUS (apakah ada toko yang inactive)
SELECT 
    s.is_active as store_active,
    COUNT(*) as record_count
FROM vast_finance_data_new vfdn
JOIN stores s ON s.id = vfdn.store_id
WHERE vfdn.source = 'excel'
GROUP BY s.is_active;

-- 6. SIMULATE DASHBOARD QUERY (dengan filter RLS)
-- Kemungkinan dashboard pakai WHERE created_by_user_id IN (active users)
SELECT 
    'Simulated Dashboard Query' as query_type,
    COUNT(*) as total_shown
FROM vast_finance_data_new vfdn
JOIN users u ON u.id = vfdn.created_by_user_id
JOIN stores s ON s.id = vfdn.store_id
WHERE vfdn.source = 'excel'
  AND vfdn.deleted_at IS NULL
  AND u.status = 'active'
  AND s.is_active = true;

-- 7. CEK SELISIH (records yang mungkin ter-filter)
SELECT 
    'Records potentially filtered' as item,
    COUNT(*) as total_filtered
FROM vast_finance_data_new vfdn
LEFT JOIN users u ON u.id = vfdn.created_by_user_id
LEFT JOIN stores s ON s.id = vfdn.store_id
WHERE vfdn.source = 'excel'
  AND (u.status != 'active' OR s.is_active != true OR u.id IS NULL OR s.id IS NULL);

-- 8. DETAIL RECORDS YANG TER-FILTER
SELECT 
    vfdn.sale_date,
    vfdn.customer_name,
    u.name as promotor,
    u.status as user_status,
    s.name as toko,
    s.is_active as store_active
FROM vast_finance_data_new vfdn
LEFT JOIN users u ON u.id = vfdn.created_by_user_id
LEFT JOIN stores s ON s.id = vfdn.store_id
WHERE vfdn.source = 'excel'
  AND (u.status != 'active' OR s.is_active != true OR u.id IS NULL OR s.id IS NULL)
LIMIT 25;
