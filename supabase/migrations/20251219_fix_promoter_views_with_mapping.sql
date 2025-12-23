-- VAST FINANCE - Fix Promoter Views with ID Mapping
-- Menggabungkan data lama dan baru dengan mapping ID
-- Created: 2024-12-19

-- Step 1: Drop semua view terkait (cascade)
DROP VIEW IF EXISTS v_agg_monthly_spv_all CASCADE;
DROP VIEW IF EXISTS v_agg_daily_spv_all CASCADE;
DROP VIEW IF EXISTS v_agg_monthly_sator_all CASCADE;
DROP VIEW IF EXISTS v_agg_daily_sator_all CASCADE;
DROP VIEW IF EXISTS v_agg_monthly_promoter_all CASCADE;
DROP VIEW IF EXISTS v_agg_daily_promoter_all CASCADE;

-- Step 2: Recreate view promoter monthly (dengan mapping ID lama ke baru)
CREATE VIEW v_agg_monthly_promoter_all AS
SELECT
    promoter_user_id,
    agg_month,
    total_input,
    total_approved,
    total_rejected,
    total_closed,
    total_pending,
    total_closing_direct,
    total_closing_followup
FROM agg_monthly_promoter
UNION ALL
SELECT
    COALESCE(m.new_id, old.promoter_id) as promoter_user_id,
    DATE_TRUNC('month', old.sale_date)::DATE as agg_month,
    COUNT(*) as total_input,
    COUNT(*) FILTER (WHERE UPPER(old.status) = 'ACC') as total_approved,
    COUNT(*) FILTER (WHERE UPPER(old.status) = 'REJECT') as total_rejected,
    COUNT(*) FILTER (WHERE UPPER(old.status) = 'ACC') as total_closed,
    COUNT(*) FILTER (WHERE UPPER(old.status) = 'PENDING') as total_pending,
    COUNT(*) FILTER (WHERE UPPER(old.status) = 'ACC') as total_closing_direct,
    0 as total_closing_followup
FROM vast_finance_data_old old
LEFT JOIN user_id_mapping_promotor m ON m.old_id = old.promoter_id
GROUP BY COALESCE(m.new_id, old.promoter_id), DATE_TRUNC('month', old.sale_date);

-- Step 3: Recreate view promoter daily (dengan mapping ID lama ke baru)
CREATE VIEW v_agg_daily_promoter_all AS
SELECT
    promoter_user_id,
    agg_date,
    total_input,
    total_approved,
    total_rejected,
    total_closed,
    total_pending,
    total_closing_direct,
    total_closing_followup
FROM agg_daily_promoter
UNION ALL
SELECT
    COALESCE(m.new_id, old.promoter_id) as promoter_user_id,
    old.sale_date as agg_date,
    COUNT(*) as total_input,
    COUNT(*) FILTER (WHERE UPPER(old.status) = 'ACC') as total_approved,
    COUNT(*) FILTER (WHERE UPPER(old.status) = 'REJECT') as total_rejected,
    COUNT(*) FILTER (WHERE UPPER(old.status) = 'ACC') as total_closed,
    COUNT(*) FILTER (WHERE UPPER(old.status) = 'PENDING') as total_pending,
    COUNT(*) FILTER (WHERE UPPER(old.status) = 'ACC') as total_closing_direct,
    0 as total_closing_followup
FROM vast_finance_data_old old
LEFT JOIN user_id_mapping_promotor m ON m.old_id = old.promoter_id
GROUP BY COALESCE(m.new_id, old.promoter_id), old.sale_date;

-- Step 4: Recreate view sator monthly
CREATE VIEW v_agg_monthly_sator_all AS
SELECT
    h.atasan_id AS sator_user_id,
    v.agg_month,
    SUM(COALESCE(v.total_input, 0)) AS total_input,
    SUM(COALESCE(v.total_approved, 0)) AS total_approved,
    SUM(COALESCE(v.total_rejected, 0)) AS total_rejected,
    SUM(COALESCE(v.total_closed, 0)) AS total_closed,
    SUM(COALESCE(v.total_pending, 0)) AS total_pending,
    SUM(COALESCE(v.total_closing_direct, 0)) AS total_closing_direct,
    SUM(COALESCE(v.total_closing_followup, 0)) AS total_closing_followup,
    COUNT(DISTINCT v.promoter_user_id) AS promotor_count
FROM v_agg_monthly_promoter_all v
JOIN hierarchy h ON h.user_id = v.promoter_user_id
WHERE h.atasan_id IS NOT NULL
GROUP BY h.atasan_id, v.agg_month;

-- Step 5: Recreate view sator daily
CREATE VIEW v_agg_daily_sator_all AS
SELECT
    h.atasan_id AS sator_user_id,
    v.agg_date,
    SUM(COALESCE(v.total_input, 0)) AS total_input,
    SUM(COALESCE(v.total_approved, 0)) AS total_approved,
    SUM(COALESCE(v.total_rejected, 0)) AS total_rejected,
    SUM(COALESCE(v.total_closed, 0)) AS total_closed,
    SUM(COALESCE(v.total_pending, 0)) AS total_pending,
    SUM(COALESCE(v.total_closing_direct, 0)) AS total_closing_direct,
    SUM(COALESCE(v.total_closing_followup, 0)) AS total_closing_followup,
    COUNT(DISTINCT v.promoter_user_id) AS promotor_count
FROM v_agg_daily_promoter_all v
JOIN hierarchy h ON h.user_id = v.promoter_user_id
WHERE h.atasan_id IS NOT NULL
GROUP BY h.atasan_id, v.agg_date;

-- Step 6: Recreate view spv monthly
CREATE VIEW v_agg_monthly_spv_all AS
SELECT
    h2.atasan_id AS spv_user_id,
    vs.agg_month,
    SUM(COALESCE(vs.total_input, 0)) AS total_input,
    SUM(COALESCE(vs.total_approved, 0)) AS total_approved,
    SUM(COALESCE(vs.total_rejected, 0)) AS total_rejected,
    SUM(COALESCE(vs.total_closed, 0)) AS total_closed,
    SUM(COALESCE(vs.total_pending, 0)) AS total_pending,
    SUM(COALESCE(vs.total_closing_direct, 0)) AS total_closing_direct,
    SUM(COALESCE(vs.total_closing_followup, 0)) AS total_closing_followup,
    COUNT(DISTINCT vs.sator_user_id) AS sator_count
FROM v_agg_monthly_sator_all vs
JOIN hierarchy h2 ON h2.user_id = vs.sator_user_id
WHERE h2.atasan_id IS NOT NULL
GROUP BY h2.atasan_id, vs.agg_month;

-- Step 7: Recreate view spv daily
CREATE VIEW v_agg_daily_spv_all AS
SELECT
    h2.atasan_id AS spv_user_id,
    vs.agg_date,
    SUM(COALESCE(vs.total_input, 0)) AS total_input,
    SUM(COALESCE(vs.total_approved, 0)) AS total_approved,
    SUM(COALESCE(vs.total_rejected, 0)) AS total_rejected,
    SUM(COALESCE(vs.total_closed, 0)) AS total_closed,
    SUM(COALESCE(vs.total_pending, 0)) AS total_pending,
    SUM(COALESCE(vs.total_closing_direct, 0)) AS total_closing_direct,
    SUM(COALESCE(vs.total_closing_followup, 0)) AS total_closing_followup,
    COUNT(DISTINCT vs.sator_user_id) AS sator_count
FROM v_agg_daily_sator_all vs
JOIN hierarchy h2 ON h2.user_id = vs.sator_user_id
WHERE h2.atasan_id IS NOT NULL
GROUP BY h2.atasan_id, vs.agg_date;
