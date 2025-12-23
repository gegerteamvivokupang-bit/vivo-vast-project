-- VAST FINANCE - Create Aggregate Views for SATOR and SPV
-- Created: 2024-12-19
--
-- Struktur Hirarki:
--   Manager Area → SPV → SATOR → PROMOTOR
--
-- Catatan Khusus:
--   Anfal & Wilibroddus adalah SPV yang juga bertindak sebagai SATOR
--   Mereka muncul di kedua view (sator & spv)
--
-- View ini berdasarkan struktur hierarchy, bukan role di tabel users
-- ================================================================

-- ================================================================
-- VIEW: v_agg_monthly_sator_all
-- Agregat bulanan per SATOR (SUM dari semua promotor di bawahnya)
-- ================================================================
CREATE OR REPLACE VIEW v_agg_monthly_sator_all AS
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

-- ================================================================
-- VIEW: v_agg_daily_sator_all
-- Agregat harian per SATOR (SUM dari semua promotor di bawahnya)
-- ================================================================
CREATE OR REPLACE VIEW v_agg_daily_sator_all AS
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

-- ================================================================
-- VIEW: v_agg_monthly_spv_all
-- Agregat bulanan per SPV (SUM dari semua sator di bawahnya)
-- SPV = atasan dari user yang juga punya bawahan (atasan level 2)
-- ================================================================
CREATE OR REPLACE VIEW v_agg_monthly_spv_all AS
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

-- ================================================================
-- VIEW: v_agg_daily_spv_all
-- Agregat harian per SPV (SUM dari semua sator di bawahnya)
-- ================================================================
CREATE OR REPLACE VIEW v_agg_daily_spv_all AS
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

-- ================================================================
-- KOMENTAR PENGGUNAAN:
-- ================================================================
--
-- 1. SPV melihat data SATOR di bawahnya:
--    SELECT * FROM v_agg_monthly_sator_all
--    WHERE sator_user_id IN (
--      SELECT user_id FROM hierarchy WHERE atasan_id = [spv_user_id]
--    )
--
-- 2. SPV melihat data PROMOTOR (detail):
--    SELECT * FROM v_agg_monthly_promoter_all
--    WHERE promoter_user_id IN (
--      SELECT user_id FROM hierarchy WHERE atasan_id IN (
--        SELECT user_id FROM hierarchy WHERE atasan_id = [spv_user_id]
--      )
--    )
--
-- 3. Manager Area melihat data SPV:
--    SELECT * FROM v_agg_monthly_spv_all
--    WHERE spv_user_id IN (
--      SELECT user_id FROM hierarchy WHERE area = [area_name]
--    )
--
-- 4. Kasus Anfal/Wilibroddus (SPV + SATOR):
--    - Sebagai SATOR: query v_agg_monthly_sator_all WHERE sator_user_id = [id]
--    - Sebagai SPV: query v_agg_monthly_spv_all WHERE spv_user_id = [id]
--    - Atau gabung keduanya untuk total area
-- ================================================================
