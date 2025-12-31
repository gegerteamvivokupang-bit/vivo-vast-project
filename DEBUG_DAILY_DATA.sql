-- ============================================================================
-- CHECK DATA HARIAN - Debug kenapa data tidak muncul di halaman laporan
-- ============================================================================

-- 1. CEK DATA RAW: Distribusi data per tanggal (26-30 Desember)
SELECT 
    sale_date,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'acc') AS acc,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending,
    COUNT(*) FILTER (WHERE status = 'reject') AS reject
FROM vast_finance_data_new
WHERE source = 'excel'
  AND sale_date >= '2025-12-26'
  AND sale_date <= '2025-12-31'
GROUP BY sale_date
ORDER BY sale_date;

-- 2. CEK VIEW v_agg_daily_promoter_all: Apakah data muncul?
SELECT 
    agg_date,
    COUNT(*) AS promotor_count,
    SUM(total_input) AS total_input,
    SUM(total_closed) AS total_closed,
    SUM(total_pending) AS total_pending,
    SUM(total_rejected) AS total_rejected
FROM v_agg_daily_promoter_all
WHERE agg_date >= '2025-12-26'
  AND agg_date <= '2025-12-31'
GROUP BY agg_date
ORDER BY agg_date;

-- 3. CEK VIEW DEFINITION: Bagaimana view ini dibuat?
SELECT 
    viewname,
    definition 
FROM pg_views 
WHERE viewname = 'v_agg_daily_promoter_all';

-- 4. CEK apakah VIEW perlu refresh (jika materialized)
SELECT 
    matviewname,
    ispopulated
FROM pg_matviews
WHERE matviewname LIKE '%daily%' OR matviewname LIKE '%agg%';

-- 5. CEK sample data dari view untuk tanggal 30 Des
SELECT *
FROM v_agg_daily_promoter_all
WHERE agg_date = '2025-12-30'
LIMIT 10;
