-- ============================================================================
-- REFRESH AGGREGATION VIEWS untuk Manager Dashboard
-- ============================================================================

-- Dashboard Manager pakai:
-- - v_agg_monthly_promoter_all
-- - v_agg_monthly_sator_all  
-- - v_agg_monthly_spv_all

-- CEK: Apakah views ini MATERIALIZED atau reguler VIEW?
SELECT 
    schemaname,
    matviewname as viewname,
    'MATERIALIZED VIEW' as view_type
FROM pg_matviews
WHERE matviewname LIKE '%agg_monthly%'
UNION ALL
SELECT 
    schemaname,
    viewname,
    'REGULAR VIEW' as view_type
FROM pg_views
WHERE viewname LIKE '%agg_monthly%'
  AND schemaname = 'public'
ORDER BY viewname;

-- ============================================================================
-- JIKA MATERIALIZED VIEW: REFRESH
-- ============================================================================

-- Uncomment jika ternyata MATERIALIZED VIEW:
-- REFRESH MATERIALIZED VIEW v_agg_monthly_promoter_all;
-- REFRESH MATERIALIZED VIEW v_agg_monthly_sator_all;
-- REFRESH MATERIALIZED VIEW v_agg_monthly_spv_all;

-- ============================================================================
-- CEK ISI VIEWS untuk Desember 2025
-- ============================================================================

-- 1. Cek v_agg_monthly_promoter_all
SELECT 
    'v_agg_monthly_promoter_all' as view_name,
    agg_month,
    COUNT(*) as promotor_count,
    SUM(total_input) as total_input,
    SUM(total_closed) as total_closed
FROM v_agg_monthly_promoter_all
WHERE agg_month = '2025-12-01'
GROUP BY agg_month;

-- 2. Cek v_agg_monthly_sator_all
SELECT 
    'v_agg_monthly_sator_all' as view_name,
    agg_month,
    COUNT(*) as sator_count,
    SUM(total_input) as total_input,
    SUM(total_closed) as total_closed
FROM v_agg_monthly_sator_all
WHERE agg_month = '2025-12-01'
GROUP BY agg_month;

-- 3. Cek v_agg_monthly_spv_all
SELECT 
    'v_agg_monthly_spv_all' as view_name,
    agg_month,
    COUNT(*) as spv_count,
    SUM(total_input) as total_input,
    SUM(total_closed) as total_closed
FROM v_agg_monthly_spv_all
WHERE agg_month = '2025-12-01'
GROUP BY agg_month;

-- ============================================================================
-- JIKA VIEWS KOSONG: CEK RAW DATA
-- ============================================================================

-- Cek apakah raw data ada di tabel asli
SELECT 
    'Raw Data Check' as item,
    DATE_TRUNC('month', sale_date) as month,
    COUNT(*) as total_records
FROM vast_finance_data_new
WHERE source = 'excel'
  AND DATE_TRUNC('month', sale_date) = '2025-12-01'
GROUP BY DATE_TRUNC('month', sale_date);

-- ============================================================================
-- SOLUTION: Jika views tidak auto-refresh, buat TRIGGER atau refresh manual
-- ============================================================================

-- Query untuk force refresh aggregation (jika views adalah regular VIEW dengan underlying tables)
-- Regular VIEW otomatis update saat query, tapi ada possibility caching

-- Verify: Total input per promotor untuk Desember
SELECT 
    u.name as promotor,
    COUNT(*) as total_input,
    COUNT(*) FILTER (WHERE vfdn.status = 'acc') as total_closed
FROM vast_finance_data_new vfdn
JOIN users u ON u.id = vfdn.created_by_user_id
WHERE vfdn.source = 'excel'
  AND DATE_TRUNC('month', vfdn.sale_date) = '2025-12-01'
GROUP BY u.name
ORDER BY total_input DESC
LIMIT 10;
