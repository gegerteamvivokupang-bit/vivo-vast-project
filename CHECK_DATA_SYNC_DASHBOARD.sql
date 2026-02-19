-- ============================================================================
-- VAST FINANCE - CEK SINKRONISASI DATA DASHBOARD
-- Script untuk menemukan masalah data tidak sinkron antara database dan dashboard
-- Created: 2026-02-19
-- ============================================================================

-- ============================================================================
-- BAGIAN 1: CEK STRUKTUR DATA STATUS
-- ============================================================================
-- Lihat apa saja kolom status yang ada dan nilainya
SELECT 
    '1. SAMPLE DATA STATUS' as section,
    id,
    status,
    approval_status,
    transaction_status,
    sale_date,
    created_by_user_id
FROM vast_finance_data_new
WHERE deleted_at IS NULL
ORDER BY sale_date DESC
LIMIT 20;

-- Cek distribusi nilai status
SELECT 
    '2. DISTRIBUSI STATUS' as section,
    status,
    approval_status,
    transaction_status,
    COUNT(*) as jumlah
FROM vast_finance_data_new
WHERE deleted_at IS NULL
GROUP BY status, approval_status, transaction_status
ORDER BY jumlah DESC;

-- ============================================================================
-- BAGIAN 2: CEK PERHITUNGAN RAW vs AGGREGATE
-- ============================================================================

-- 2A. Cek Total Input per Promotor (Hari Ini)
SELECT 
    '2A. INPUT HARI INI PER PROMOTOR' as test_name,
    COALESCE(raw.promoter_user_id, agg.promoter_user_id) as promotor_id,
    u.name as promotor_name,
    raw.total_raw as "Raw Data",
    agg.total_input as "Aggregate",
    CASE 
        WHEN raw.total_raw = agg.total_input THEN '✅ MATCH'
        ELSE '❌ BEDA: ' || (raw.total_raw - COALESCE(agg.total_input, 0))
    END as status
FROM (
    SELECT created_by_user_id as promoter_user_id, COUNT(*) as total_raw
    FROM vast_finance_data_new
    WHERE DATE(sale_date) = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE
      AND deleted_at IS NULL
    GROUP BY created_by_user_id
) raw
FULL OUTER JOIN (
    SELECT promoter_user_id, total_input
    FROM agg_daily_promoter
    WHERE agg_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE
) agg ON raw.promoter_user_id = agg.promoter_user_id
LEFT JOIN users u ON COALESCE(raw.promoter_user_id, agg.promoter_user_id) = u.id
ORDER BY status DESC, promotor_name;

-- 2B. Cek Total Input per Promotor (Bulan Ini)
SELECT 
    '2B. INPUT BULAN INI PER PROMOTOR' as test_name,
    COALESCE(raw.promoter_user_id, agg.promoter_user_id) as promotor_id,
    u.name as promotor_name,
    raw.total_raw as "Raw Data",
    agg.total_input as "Aggregate",
    CASE 
        WHEN raw.total_raw = agg.total_input THEN '✅ MATCH'
        ELSE '❌ BEDA: ' || (raw.total_raw - COALESCE(agg.total_input, 0))
    END as status
FROM (
    SELECT created_by_user_id as promoter_user_id, COUNT(*) as total_raw
    FROM vast_finance_data_new
    WHERE DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
      AND deleted_at IS NULL
    GROUP BY created_by_user_id
) raw
FULL OUTER JOIN (
    SELECT promoter_user_id, total_input
    FROM agg_monthly_promoter
    WHERE agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
) agg ON raw.promoter_user_id = agg.promoter_user_id
LEFT JOIN users u ON COALESCE(raw.promoter_user_id, agg.promoter_user_id) = u.id
ORDER BY status DESC, promotor_name;

-- ============================================================================
-- BAGIAN 3: CEK PERHITUNGAN STATUS (PENDING, REJECT, ACC/CLOSED)
-- ============================================================================

-- 3A. Cek perhitungan PENDING
SELECT 
    '3A. CEK PENDING COUNT' as test_name,
    raw.pending_count as "Raw Pending",
    agg.pending_agg as "Agg Pending",
    CASE 
        WHEN raw.pending_count = agg.pending_agg THEN '✅ MATCH'
        ELSE '❌ BEDA: ' || (raw.pending_count - COALESCE(agg.pending_agg, 0))
    END as status
FROM (
    -- Raw data: count berdasarkan logika yang digunakan di agregasi
    SELECT COUNT(*) as pending_count
    FROM vast_finance_data_new
    WHERE DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
      AND deleted_at IS NULL
      AND (
        (approval_status = 'approved' AND transaction_status = 'not_closed')
        OR UPPER(status) = 'PENDING'
      )
) raw
CROSS JOIN (
    SELECT COALESCE(SUM(total_pending), 0) as pending_agg
    FROM agg_monthly_promoter
    WHERE agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
) agg;

-- 3B. Cek perhitungan REJECTED
SELECT 
    '3B. CEK REJECTED COUNT' as test_name,
    raw.rejected_count as "Raw Rejected",
    agg.rejected_agg as "Agg Rejected",
    CASE 
        WHEN raw.rejected_count = agg.rejected_agg THEN '✅ MATCH'
        ELSE '❌ BEDA: ' || (raw.rejected_count - COALESCE(agg.rejected_agg, 0))
    END as status
FROM (
    SELECT COUNT(*) as rejected_count
    FROM vast_finance_data_new
    WHERE DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
      AND deleted_at IS NULL
      AND (approval_status = 'rejected' OR UPPER(status) = 'REJECT')
) raw
CROSS JOIN (
    SELECT COALESCE(SUM(total_rejected), 0) as rejected_agg
    FROM agg_monthly_promoter
    WHERE agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
) agg;

-- 3C. Cek perhitungan CLOSED/ACC
SELECT 
    '3C. CEK CLOSED/ACC COUNT' as test_name,
    raw.closed_count as "Raw Closed",
    agg.closed_agg as "Agg Closed",
    CASE 
        WHEN raw.closed_count = agg.closed_agg THEN '✅ MATCH'
        ELSE '❌ BEDA: ' || (raw.closed_count - COALESCE(agg.closed_agg, 0))
    END as status
FROM (
    SELECT COUNT(*) as closed_count
    FROM vast_finance_data_new
    WHERE DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
      AND deleted_at IS NULL
      AND (transaction_status = 'closed' OR UPPER(status) = 'ACC')
) raw
CROSS JOIN (
    SELECT COALESCE(SUM(total_closed), 0) as closed_agg
    FROM agg_monthly_promoter
    WHERE agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
) agg;

-- 3D. Cek konsistensi: INPUT harus = PENDING + CLOSED + REJECTED
SELECT 
    '3D. CEK KONSISTENSI: INPUT = PENDING + CLOSED + REJECTED' as test_name,
    total_input as "Total Input",
    (total_pending + total_closed + total_rejected) as "P+C+R",
    total_pending as "Pending",
    total_closed as "Closed",
    total_rejected as "Rejected",
    CASE 
        WHEN total_input = (total_pending + total_closed + total_rejected) THEN '✅ BALANCE'
        ELSE '❌ TIDAK BALANCE! Selisih: ' || (total_input - (total_pending + total_closed + total_rejected))
    END as status
FROM (
    SELECT 
        SUM(total_input) as total_input,
        SUM(total_pending) as total_pending,
        SUM(total_closed) as total_closed,
        SUM(total_rejected) as total_rejected
    FROM agg_monthly_promoter
    WHERE agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
) t;

-- ============================================================================
-- BAGIAN 4: CEK HIERARKI AGGREGASI
-- Promotor → SATOR → SPV → Manager (Area)
-- ============================================================================

-- 4A. Cek SATOR = SUM of Promotors
SELECT 
    '4A. SATOR = SUM PROMOTOR' as test_name,
    sator.sator_user_id,
    u_sator.name as sator_name,
    sator.total_input as "SATOR Total",
    promo.promo_sum as "Sum Promotor",
    CASE 
        WHEN sator.total_input = promo.promo_sum THEN '✅ MATCH'
        ELSE '❌ BEDA: ' || (sator.total_input - COALESCE(promo.promo_sum, 0))
    END as status
FROM (
    SELECT sator_user_id, total_input
    FROM v_agg_monthly_sator_all
    WHERE agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
) sator
LEFT JOIN (
    SELECT h.atasan_id, SUM(COALESCE(v.total_input, 0)) as promo_sum
    FROM v_agg_monthly_promoter_all v
    JOIN hierarchy h ON h.user_id = v.promoter_user_id
    WHERE v.agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
    GROUP BY h.atasan_id
) promo ON sator.sator_user_id = promo.atasan_id
LEFT JOIN users u_sator ON u_sator.id = sator.sator_user_id
ORDER BY status DESC, sator_name;

-- 4B. Cek SPV = SUM of SATORs
SELECT 
    '4B. SPV = SUM SATOR' as test_name,
    spv.spv_user_id,
    u_spv.name as spv_name,
    spv.total_input as "SPV Total",
    sator.sator_sum as "Sum SATOR",
    CASE 
        WHEN spv.total_input = sator.sator_sum THEN '✅ MATCH'
        ELSE '❌ BEDA: ' || (spv.total_input - COALESCE(sator.sator_sum, 0))
    END as status
FROM (
    SELECT spv_user_id, total_input
    FROM v_agg_monthly_spv_all
    WHERE agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
) spv
LEFT JOIN (
    SELECT h2.atasan_id, SUM(COALESCE(vs.total_input, 0)) as sator_sum
    FROM v_agg_monthly_sator_all vs
    JOIN hierarchy h2 ON h2.user_id = vs.sator_user_id
    WHERE vs.agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
    GROUP BY h2.atasan_id
) sator ON spv.spv_user_id = sator.atasan_id
LEFT JOIN users u_spv ON u_spv.id = spv.spv_user_id
ORDER BY status DESC, spv_name;

-- ============================================================================
-- BAGIAN 5: CEK SPV DUAL ROLE (SPV yang juga punya promotor langsung)
-- ============================================================================
SELECT 
    '5. SPV DUAL ROLE CHECK' as test_name,
    spv.id as spv_id,
    spv.name as spv_name,
    h.area,
    -- Promotor langsung di bawah SPV
    direct.direct_promotor_count as "Direct Promotor",
    direct.direct_input as "Direct Input",
    -- SATOR di bawah SPV
    sator.sator_count as "SATOR Count",
    sator.sator_input as "SATOR Input",
    -- Total dari view SPV
    view.total_input as "View SPV Total",
    -- Expected total
    (COALESCE(direct.direct_input, 0) + COALESCE(sator.sator_input, 0)) as "Expected Total",
    CASE 
        WHEN view.total_input = (COALESCE(direct.direct_input, 0) + COALESCE(sator.sator_input, 0)) THEN '✅ MATCH'
        ELSE '❌ BEDA'
    END as status
FROM users spv
LEFT JOIN hierarchy h ON h.user_id = spv.id
-- Direct promotors under this SPV
LEFT JOIN (
    SELECT h2.atasan_id, COUNT(*) as direct_promotor_count, SUM(COALESCE(v.total_input, 0)) as direct_input
    FROM hierarchy h2
    JOIN v_agg_monthly_promoter_all v ON v.promoter_user_id = h2.user_id
    JOIN users u ON u.id = h2.user_id AND u.role = 'promotor'
    WHERE v.agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
    GROUP BY h2.atasan_id
) direct ON direct.atasan_id = spv.id
-- SATORs under this SPV
LEFT JOIN (
    SELECT h2.atasan_id, COUNT(DISTINCT vs.sator_user_id) as sator_count, SUM(COALESCE(vs.total_input, 0)) as sator_input
    FROM v_agg_monthly_sator_all vs
    JOIN hierarchy h2 ON h2.user_id = vs.sator_user_id
    WHERE vs.agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
    GROUP BY h2.atasan_id
) sator ON sator.atasan_id = spv.id
-- SPV view
LEFT JOIN (
    SELECT spv_user_id, total_input
    FROM v_agg_monthly_spv_all
    WHERE agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
) view ON view.spv_user_id = spv.id
WHERE spv.role = 'spv' AND spv.status = 'active'
ORDER BY spv_name;

-- ============================================================================
-- BAGIAN 6: CEK TOTAL GRAND (Manager Level)
-- ============================================================================
SELECT 
    '6. GRAND TOTAL MANAGER' as test_name,
    raw.grand_total as "Raw Grand Total",
    agg.grand_total as "Agg Grand Total",
    view_sator.grand_total as "Sum SATOR View",
    view_spv.grand_total as "Sum SPV View",
    CASE 
        WHEN raw.grand_total = agg.grand_total 
         AND agg.grand_total = view_sator.grand_total 
         AND view_sator.grand_total = view_spv.grand_total THEN '✅ ALL MATCH'
        ELSE '❌ TIDAK SINKRON'
    END as status
FROM (
    SELECT COUNT(*) as grand_total
    FROM vast_finance_data_new
    WHERE DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
      AND deleted_at IS NULL
) raw
CROSS JOIN (
    SELECT COALESCE(SUM(total_input), 0) as grand_total
    FROM agg_monthly_promoter
    WHERE agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
) agg
CROSS JOIN (
    SELECT COALESCE(SUM(total_input), 0) as grand_total
    FROM v_agg_monthly_sator_all
    WHERE agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
) view_sator
CROSS JOIN (
    SELECT COALESCE(SUM(total_input), 0) as grand_total
    FROM v_agg_monthly_spv_all
    WHERE agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
) view_spv;

-- ============================================================================
-- BAGIAN 7: CEK PROMOTOR YANG TIDAK ADA DI HIERARCHY
-- ============================================================================
SELECT 
    '7. PROMOTOR TIDAK ADA DI HIERARCHY' as test_name,
    v.promoter_user_id,
    u.name as promotor_name,
    v.total_input,
    h.user_id as hierarchy_exists
FROM v_agg_monthly_promoter_all v
LEFT JOIN users u ON u.id = v.promoter_user_id
LEFT JOIN hierarchy h ON h.user_id = v.promoter_user_id
WHERE v.agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
  AND h.user_id IS NULL
  AND v.total_input > 0
ORDER BY v.total_input DESC;

-- ============================================================================
-- BAGIAN 8: CEK PROMOTOR DENGAN ATASAN_ID NULL
-- ============================================================================
SELECT 
    '8. PROMOTOR DENGAN ATASAN NULL' as test_name,
    h.user_id,
    u.name,
    u.role,
    h.atasan_id,
    h.area
FROM hierarchy h
JOIN users u ON u.id = h.user_id
WHERE u.role = 'promotor' AND h.atasan_id IS NULL;

-- ============================================================================
-- BAGIAN 9: CEK TRIGGER STATUS
-- ============================================================================
SELECT 
    '9. TRIGGER STATUS' as test_name,
    tgname as trigger_name,
    CASE WHEN tgenabled = 'O' THEN '✅ ACTIVE' ELSE '❌ DISABLED' END as status
FROM pg_trigger
WHERE tgname IN ('trigger_agg_on_submission', 'trigger_agg_on_conversion');

-- ============================================================================
-- BAGIAN 10: RINGKASAN
-- ============================================================================
SELECT 
    '=== RINGKASAN ===' as info,
    'Jalankan semua query di atas untuk menemukan masalah sinkronisasi' as keterangan,
    'Jika ada ❌, periksa query terkait untuk detail masalah' as action;
