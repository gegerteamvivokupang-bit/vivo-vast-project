-- ============================================================================
-- VERIFICATION - CEK APAKAH FIX BERHASIL
-- Run semua query ini setelah execute FIX_TRIGGER_STORE_CONVERSION.sql
-- ============================================================================

-- ============================================================================
-- PART 1: CEK FUNGSI BARU SUDAH ADA
-- ============================================================================

SELECT '=== PART 1: CEK FUNGSI BARU ===' AS test_section;

SELECT 
    proname as "Function Name",
    '✅ EXISTS' as status
FROM pg_proc 
WHERE proname IN (
    'refresh_daily_store_aggregates_for_date',
    'refresh_monthly_store_aggregates_for_month',
    'trigger_refresh_aggregates_conversion'
)
ORDER BY proname;

-- Expected: 3 rows (semua fungsi ada)

-- ============================================================================
-- PART 2: CEK TRIGGER CONVERSION SUDAH FOR EACH ROW
-- ============================================================================

SELECT '=== PART 2: CEK TRIGGER TYPE ===' AS test_section;

SELECT 
    tgname as "Trigger Name",
    CASE 
        WHEN pg_get_triggerdef(oid) LIKE '%FOR EACH ROW%' THEN '✅ FOR EACH ROW (BENAR!)'
        WHEN pg_get_triggerdef(oid) LIKE '%FOR EACH STATEMENT%' THEN '❌ FOR EACH STATEMENT (MASIH SALAH!)'
        ELSE '⚠️ Unknown Type'
    END as "Status",
    pg_get_triggerdef(oid) as "Definition"
FROM pg_trigger 
WHERE tgname = 'trigger_agg_on_conversion' 
  AND tgrelid = 'conversions'::regclass;

-- Expected: ✅ FOR EACH ROW

-- ============================================================================
-- PART 3: CEK TRIGGER PAKAI FUNGSI YANG BENAR
-- ============================================================================

SELECT '=== PART 3: CEK TRIGGER FUNCTION ===' AS test_section;

SELECT 
    tgname as "Trigger Name",
    CASE 
        WHEN pg_get_triggerdef(oid) LIKE '%trigger_refresh_aggregates_conversion%' THEN '✅ Pakai fungsi conversion (BENAR!)'
        WHEN pg_get_triggerdef(oid) LIKE '%trigger_refresh_aggregates()%' THEN '❌ Masih pakai fungsi lama (SALAH!)'
        ELSE '⚠️ Unknown'
    END as "Status"
FROM pg_trigger 
WHERE tgname = 'trigger_agg_on_conversion' 
  AND tgrelid = 'conversions'::regclass;

-- Expected: ✅ Pakai fungsi conversion

-- ============================================================================
-- PART 4: FUNCTIONAL TEST - Store Aggregates untuk Tanggal Tertentu
-- ============================================================================

SELECT '=== PART 4: TEST STORE AGGREGATES ===' AS test_section;

-- Test: Refresh kemarin manual
DO $$
DECLARE
    v_yesterday DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE - INTERVAL '1 day';
    v_count_before INTEGER;
    v_count_after INTEGER;
BEGIN
    -- Cek sebelum refresh
    SELECT COUNT(*) INTO v_count_before
    FROM agg_daily_store
    WHERE agg_date = v_yesterday;
    
    RAISE NOTICE 'Sebelum refresh: % rows', v_count_before;
    
    -- Refresh kemarin
    PERFORM refresh_daily_store_aggregates_for_date(v_yesterday);
    
    -- Cek setelah refresh
    SELECT COUNT(*) INTO v_count_after
    FROM agg_daily_store
    WHERE agg_date = v_yesterday;
    
    RAISE NOTICE 'Setelah refresh: % rows', v_count_after;
    RAISE NOTICE 'Status: %', CASE WHEN v_count_after > 0 THEN '✅ WORKING' ELSE '⚠️ No data (normal jika tidak ada data kemarin)' END;
END $$;

-- ============================================================================
-- PART 5: FUNCTIONAL TEST - Trigger Jalan Otomatis
-- ============================================================================

SELECT '=== PART 5: TEST TRIGGER AUTO-REFRESH ===' AS test_section;

-- Cek apakah ada data hari ini
SELECT 
    'Hari Ini' as period,
    COUNT(*) as "Rows in Raw Data"
FROM vast_finance_data_new
WHERE DATE(sale_date) = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE
  AND deleted_at IS NULL;

-- Cek apakah ter-agregasi
SELECT 
    'Hari Ini' as period,
    'Promoter Agg' as table_name,
    COUNT(*) as "Rows in Aggregate"
FROM agg_daily_promoter
WHERE agg_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE

UNION ALL

SELECT 
    'Hari Ini',
    'Store Agg',
    COUNT(*)
FROM agg_daily_store
WHERE agg_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE;

-- Expected: Jika ada raw data, harus ada aggregates

-- ============================================================================
-- PART 6: TEST CONVERSION TRIGGER (Jika Ada Data Conversion)
-- ============================================================================

SELECT '=== PART 6: TEST CONVERSION TRIGGER ===' AS test_section;

-- Cek apakah ada data conversion
SELECT 
    COUNT(*) as "Total Conversions",
    COUNT(DISTINCT transaction_id) as "Unique Transactions"
FROM conversions;

-- Jika ada conversion, cek apakah aggregates ter-update
-- (Test ini optional, hanya jika ada conversion data)

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT '=== SUMMARY ===' AS section;

SELECT 
    'Jika semua bagian ✅, maka fix BERHASIL!' as result,
    'Jika ada ❌, ada yang perlu diperbaiki' as note;
