-- ============================================================================
-- VALIDATION: CEK MATCH DATA DATABASE VS EXCEL
-- ============================================================================

-- 1. CEK TOTAL RECORDS
SELECT 
    'Total Records' as check_item,
    COUNT(*) as database_count,
    965 as excel_count,
    CASE 
        WHEN COUNT(*) = 965 THEN '✅ MATCH'
        ELSE '❌ NOT MATCH'
    END as status
FROM vast_finance_data_new
WHERE source = 'excel';

-- 2. CEK DISTRIBUSI STATUS
SELECT 
    'Status Distribution' as check_item,
    status,
    COUNT(*) as database_count,
    CASE 
        WHEN status = 'acc' THEN 220
        WHEN status = 'pending' THEN 135
        WHEN status = 'reject' THEN 610
    END as excel_count,
    CASE 
        WHEN (status = 'acc' AND COUNT(*) = 220) OR
             (status = 'pending' AND COUNT(*) = 135) OR
             (status = 'reject' AND COUNT(*) = 610)
        THEN '✅ MATCH'
        ELSE '❌ NOT MATCH'
    END as status_check
FROM vast_finance_data_new
WHERE source = 'excel'
GROUP BY status
ORDER BY status;

-- 3. CEK RANGE TANGGAL
SELECT 
    'Date Range' as check_item,
    MIN(sale_date) as min_date,
    MAX(sale_date) as max_date,
    COUNT(DISTINCT sale_date) as unique_dates,
    CASE 
        WHEN MIN(sale_date) = '2025-12-01' AND MAX(sale_date) = '2025-12-25'
        THEN '✅ MATCH (Dec 1-25)'
        ELSE '❌ CHECK DATES'
    END as status
FROM vast_finance_data_new
WHERE source = 'excel';

-- 4. CEK DISTRIBUSI PER TANGGAL (harus 25 hari)
SELECT 
    sale_date,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'acc') as acc,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'reject') as reject
FROM vast_finance_data_new
WHERE source = 'excel'
GROUP BY sale_date
ORDER BY sale_date;

-- 5. CEK PROMOTOR (harus ada 73 unique promotor)
SELECT 
    'Unique Promotors' as check_item,
    COUNT(DISTINCT created_by_user_id) as database_count,
    73 as expected_count,
    CASE 
        WHEN COUNT(DISTINCT created_by_user_id) >= 70
        THEN '✅ OK'
        ELSE '❌ CHECK'
    END as status
FROM vast_finance_data_new
WHERE source = 'excel';

-- 6. CEK TOKO (harus tersebar di berbagai toko)
SELECT 
    'Unique Stores' as check_item,
    COUNT(DISTINCT store_id) as database_count,
    CASE 
        WHEN COUNT(DISTINCT store_id) >= 10
        THEN '✅ OK (Multiple stores)'
        ELSE '❌ CHECK'
    END as status
FROM vast_finance_data_new
WHERE source = 'excel';

-- 7. CEK PEKERJAAN (harus hanya 7 kategori valid)
SELECT 
    'Pekerjaan Categories' as check_item,
    pekerjaan,
    COUNT(*) as count,
    CASE 
        WHEN pekerjaan IN ('PNS', 'Pegawai Swasta', 'Buruh', 'Pelajar', 'IRT', 'Wiraswasta', 'TNI/Polri')
        THEN '✅ VALID'
        ELSE '❌ INVALID'
    END as validation
FROM vast_finance_data_new
WHERE source = 'excel'
GROUP BY pekerjaan
ORDER BY count DESC;

-- 8. CEK NULL VALUES (kolom required tidak boleh NULL)
SELECT 
    'Null Check' as check_item,
    COUNT(*) FILTER (WHERE customer_name IS NULL) as null_customer_name,
    COUNT(*) FILTER (WHERE customer_phone IS NULL OR customer_phone = '') as null_phone,
    COUNT(*) FILTER (WHERE pekerjaan IS NULL) as null_pekerjaan,
    COUNT(*) FILTER (WHERE status IS NULL) as null_status,
    CASE 
        WHEN COUNT(*) FILTER (WHERE customer_name IS NULL OR pekerjaan IS NULL OR status IS NULL) = 0
        THEN '✅ NO CRITICAL NULLS'
        ELSE '❌ HAS NULLS'
    END as status
FROM vast_finance_data_new
WHERE source = 'excel';

-- 9. CEK SAMPLE DATA (random 5 records)
SELECT 
    vfdn.sale_date,
    vfdn.customer_name,
    LEFT(vfdn.customer_phone, 10) || '...' as phone,
    vfdn.pekerjaan,
    vfdn.status,
    vfdn.penghasilan,
    vfdn.limit_amount,
    u.name as promotor,
    s.name as toko
FROM vast_finance_data_new vfdn
JOIN users u ON u.id = vfdn.created_by_user_id
JOIN stores s ON s.id = vfdn.store_id
WHERE vfdn.source = 'excel'
ORDER BY RANDOM()
LIMIT 5;

-- 10. CEK DATA SPECIFIC USER BARU
SELECT 
    'New Users Data' as check_item,
    u.name as promotor,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE vfdn.status = 'acc') as acc,
    COUNT(*) FILTER (WHERE vfdn.status = 'pending') as pending,
    COUNT(*) FILTER (WHERE vfdn.status = 'reject') as reject
FROM vast_finance_data_new vfdn
JOIN users u ON u.id = vfdn.created_by_user_id
WHERE vfdn.source = 'excel'
  AND u.name IN ('DINDA CHRISTANTI', 'CHESIA ALBERTI BALIK')
GROUP BY u.name;

-- ============================================================================
-- SUMMARY CHECK
-- ============================================================================
SELECT 
    '=== FINAL VALIDATION ===' as title,
    COUNT(*) as total_records,
    MIN(sale_date) as first_date,
    MAX(sale_date) as last_date,
    COUNT(DISTINCT created_by_user_id) as unique_promotors,
    COUNT(DISTINCT store_id) as unique_stores,
    COUNT(*) FILTER (WHERE status = 'acc') as total_acc,
    COUNT(*) FILTER (WHERE status = 'pending') as total_pending,
    COUNT(*) FILTER (WHERE status = 'reject') as total_reject,
    CASE 
        WHEN COUNT(*) = 965 
         AND COUNT(*) FILTER (WHERE status = 'acc') = 220
         AND COUNT(*) FILTER (WHERE status = 'pending') = 135
         AND COUNT(*) FILTER (WHERE status = 'reject') = 610
        THEN '✅ ALL DATA MATCHED!'
        ELSE '❌ PLEASE CHECK DETAILS ABOVE'
    END as final_status
FROM vast_finance_data_new
WHERE source = 'excel';
