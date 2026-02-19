-- ============================================================================
-- VERIFICATION SCRIPT: CEK TIDAK ADA DATA YANG HILANG
-- Jalankan script ini untuk memastikan kalkulasi agregasi 100% akurat
-- ============================================================================

-- ============================================================================
-- TEST 1: CEK RAW DATA vs AGREGASI HARIAN
-- Harus match 100%!
-- ============================================================================
SELECT 
    '1. HARIAN: RAW vs AGREGASI' as test_name,
    raw.tanggal,
    raw.total_raw as "Total di RAW Data",
    agg.total_agg as "Total di Agregasi",
    CASE 
        WHEN raw.total_raw = agg.total_agg THEN '✅ MATCH'
        ELSE '❌ TIDAK MATCH!'
    END as status,
    (raw.total_raw - COALESCE(agg.total_agg, 0)) as selisih
FROM (
    -- Count dari raw data (3 hari terakhir)
    SELECT 
        DATE(sale_date) as tanggal,
        COUNT(*) as total_raw
    FROM vast_finance_data_new
    WHERE DATE(sale_date) >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE - INTERVAL '2 days'
      AND deleted_at IS NULL
    GROUP BY DATE(sale_date)
) raw
FULL OUTER JOIN (
    -- Count dari agregasi
    SELECT 
        agg_date as tanggal,
        SUM(total_input) as total_agg
    FROM agg_daily_promoter
    WHERE agg_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE - INTERVAL '2 days'
    GROUP BY agg_date
) agg ON raw.tanggal = agg.tanggal
ORDER BY raw.tanggal DESC;

-- ============================================================================
-- TEST 2: CEK DATA PER PROMOTOR - HARIAN
-- Pastikan setiap promotor ter-agregasi dengan benar
-- ============================================================================
SELECT 
    '2. CEK PER PROMOTOR (Hari Ini)' as test_name,
    COALESCE(raw.promoter_user_id, agg.promoter_user_id) as promotor_id,
    u.name as promotor_name,
    raw.total_raw as "Input di RAW",
    agg.total_input as "Input di Agregasi",
    CASE 
        WHEN raw.total_raw = agg.total_input THEN '✅'
        WHEN raw.total_raw IS NULL AND agg.total_input IS NULL THEN '✅ No Data'
        ELSE '❌ BEDA!'
    END as status
FROM (
    -- Raw data hari ini per promotor
    SELECT 
        created_by_user_id as promoter_user_id,
        COUNT(*) as total_raw
    FROM vast_finance_data_new
    WHERE DATE(sale_date) = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE
      AND deleted_at IS NULL
    GROUP BY created_by_user_id
) raw
FULL OUTER JOIN (
    -- Agregasi hari ini per promotor
    SELECT 
        promoter_user_id,
        total_input
    FROM agg_daily_promoter
    WHERE agg_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE
) agg ON raw.promoter_user_id = agg.promoter_user_id
LEFT JOIN users u ON COALESCE(raw.promoter_user_id, agg.promoter_user_id) = u.id
WHERE raw.total_raw IS NOT NULL OR agg.total_input IS NOT NULL
ORDER BY status DESC, promotor_name;

-- ============================================================================
-- TEST 3: CEK STATUS KALKULASI
-- Pastikan approved, rejected, pending dihitung benar
-- ============================================================================
SELECT 
    '3. CEK STATUS COUNT (Hari Ini)' as test_name,
    raw.status_type,
    raw.total_raw as "Count di RAW",
    agg.total_agg as "Count di Agregasi",
    CASE 
        WHEN raw.total_raw = agg.total_agg THEN '✅'
        ELSE '❌'
    END as status
FROM (
    -- Count per status dari raw
    SELECT 
        CASE 
            WHEN UPPER(status) = 'ACC' OR approval_status = 'approved' THEN 'APPROVED'
            WHEN UPPER(status) = 'REJECT' OR approval_status = 'rejected' THEN 'REJECTED'
            WHEN UPPER(status) = 'PENDING' OR (approval_status = 'approved' AND transaction_status = 'not_closed') THEN 'PENDING'
            ELSE 'OTHER'
        END as status_type,
        COUNT(*) as total_raw
    FROM vast_finance_data_new
    WHERE DATE(sale_date) = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE
      AND deleted_at IS NULL
    GROUP BY status_type
) raw
FULL OUTER JOIN (
    -- Sum dari agregasi
    SELECT 
        'APPROVED' as status_type,
        SUM(total_approved) as total_agg
    FROM agg_daily_promoter
    WHERE agg_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE
    
    UNION ALL
    
    SELECT 
        'REJECTED' as status_type,
        SUM(total_rejected) as total_agg
    FROM agg_daily_promoter
    WHERE agg_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE
    
    UNION ALL
    
    SELECT 
        'PENDING' as status_type,
        SUM(total_pending) as total_agg
    FROM agg_daily_promoter
    WHERE agg_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE
) agg ON raw.status_type = agg.status_type
ORDER BY raw.status_type;

-- ============================================================================
-- TEST 4: CEK DATA BULANAN
-- ============================================================================
SELECT 
    '4. BULANAN: RAW vs AGREGASI (Bulan Ini)' as test_name,
    raw.total_raw as "Total di RAW",
    agg.total_agg as "Total di Agregasi",
    CASE 
        WHEN raw.total_raw = agg.total_agg THEN '✅ MATCH'
        ELSE '❌ TIDAK MATCH!'
    END as status,
    (raw.total_raw - COALESCE(agg.total_agg, 0)) as selisih
FROM (
    -- Count dari raw data bulan ini
    SELECT COUNT(*) as total_raw
    FROM vast_finance_data_new
    WHERE DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
      AND deleted_at IS NULL
) raw
CROSS JOIN (
    -- Sum dari agregasi bulan ini
    SELECT SUM(total_input) as total_agg
    FROM agg_monthly_promoter
    WHERE agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
) agg;

-- ============================================================================
-- TEST 5: CEK VIEW vs TABEL AGREGASI
-- Pastikan VIEW mengembalikan data yang sama
-- ============================================================================
SELECT 
    '5. VIEW vs TABEL (Hari Ini)' as test_name,
    tbl.total_from_table as "Total dari Tabel",
    vw.total_from_view as "Total dari View",
    CASE 
        WHEN tbl.total_from_table = vw.total_from_view THEN '✅ MATCH'
        ELSE '❌ TIDAK MATCH!'
    END as status
FROM (
    SELECT SUM(total_input) as total_from_table
    FROM agg_daily_promoter
    WHERE agg_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE
) tbl
CROSS JOIN (
    SELECT SUM(total_input) as total_from_view
    FROM v_agg_daily_promoter_all
    WHERE agg_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE
) vw;

-- ============================================================================
-- TEST 6: CEK TRIGGER MASIH AKTIF
-- ============================================================================
SELECT 
    '6. CEK TRIGGER STATUS' as test_name,
    tgname as trigger_name,
    CASE 
        WHEN tgenabled = 'O' THEN '✅ ACTIVE'
        ELSE '❌ DISABLED!'
    END as status,
    pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgname IN ('trigger_agg_on_submission', 'trigger_agg_on_conversion');

-- ============================================================================
-- TEST 7: CEK ADA DATA YANG BELUM TER-AGREGASI (Missing Data)
-- ============================================================================
SELECT 
    '7. CEK MISSING DATA (Data yang belum ter-agregasi)' as test_name,
    DATE(sale_date) as tanggal_missing,
    created_by_user_id as promotor_id,
    u.name as promotor_name,
    COUNT(*) as jumlah_record_missing
FROM vast_finance_data_new vfd
LEFT JOIN agg_daily_promoter adp 
    ON adp.promoter_user_id = vfd.created_by_user_id 
    AND adp.agg_date = DATE(vfd.sale_date)
LEFT JOIN users u ON u.id = vfd.created_by_user_id
WHERE vfd.deleted_at IS NULL
  AND adp.promoter_user_id IS NULL  -- Data di raw tapi tidak di agregasi
  AND DATE(vfd.sale_date) >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE - INTERVAL '7 days'
GROUP BY DATE(sale_date), created_by_user_id, u.name
ORDER BY tanggal_missing DESC;

-- ============================================================================
-- RINGKASAN: HARUS SEMUA ✅
-- ============================================================================
SELECT 
    '=== RINGKASAN ===' as info,
    'Jika semua test ✅, data 100% akurat' as keterangan;
