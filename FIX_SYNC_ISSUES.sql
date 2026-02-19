-- ============================================================================
-- VAST FINANCE - FIX DOUBLE COUNTING DAN SPV DUAL ROLE
-- Created: 2026-02-19
-- Berdasarkan hasil analisis CHECK_DATA_SYNC_DASHBOARD.sql dan CHECK_STATUS_CONSISTENCY.sql
-- ============================================================================

-- ============================================================================
-- MASALAH 1: DATA DENGAN STATUS KONFLIK
-- 18 data dengan status='pending' tapi sudah approved+closed
-- Ini menyebabkan double counting di total_closed
-- ============================================================================

-- Lihat data yang bermasalah
SELECT 
    'MASALAH: PENDING tapi sudah CLOSED' as issue,
    id,
    status,
    approval_status,
    transaction_status,
    sale_date,
    customer_name
FROM vast_finance_data_new
WHERE deleted_at IS NULL
  AND UPPER(status) = 'PENDING'
  AND approval_status = 'approved'
  AND transaction_status = 'closed';

-- FIX: Update status data yang konflik
-- Jika transaction_status = 'closed', maka status seharusnya 'acc'
UPDATE vast_finance_data_new
SET status = 'acc'
WHERE deleted_at IS NULL
  AND UPPER(status) = 'PENDING'
  AND approval_status = 'approved'
  AND transaction_status = 'closed';

-- ============================================================================
-- MASALAH 2: LOGIKA AGREGASI YANG MENYEBABKAN DOUBLE COUNTING
-- Perbaiki fungsi agregasi untuk menghindari OR condition
-- ============================================================================

-- Drop dan recreate aggregation function dengan logika yang benar
CREATE OR REPLACE FUNCTION refresh_monthly_promoter_aggregates_for_month(target_month DATE)
RETURNS void AS $$
BEGIN
  -- Delete existing aggregates for specified month
  DELETE FROM agg_monthly_promoter WHERE agg_month = DATE_TRUNC('month', target_month);

  -- Insert fresh aggregates with FIXED logic
  INSERT INTO agg_monthly_promoter (
    promoter_user_id,
    agg_month,
    total_input,
    total_approved,
    total_rejected,
    total_closed,
    total_pending,
    total_closing_direct,
    total_closing_followup
  )
  SELECT 
    created_by_user_id as promoter_user_id,
    DATE_TRUNC('month', target_month) as agg_month,
    COUNT(*) as total_input,
    -- FIXED: Gunakan COALESCE dengan prioritas, bukan OR
    COUNT(*) FILTER (WHERE 
      COALESCE(approval_status, 
        CASE WHEN UPPER(status) IN ('ACC', 'PENDING') THEN 'approved'
             WHEN UPPER(status) = 'REJECT' THEN 'rejected'
             ELSE NULL END
      ) = 'approved'
    ) as total_approved,
    COUNT(*) FILTER (WHERE 
      COALESCE(approval_status,
        CASE WHEN UPPER(status) = 'REJECT' THEN 'rejected' ELSE NULL END
      ) = 'rejected'
    ) as total_rejected,
    -- FIXED: Gunakan COALESCE dengan prioritas transaction_status
    COUNT(*) FILTER (WHERE 
      COALESCE(transaction_status,
        CASE WHEN UPPER(status) = 'ACC' THEN 'closed'
             WHEN UPPER(status) = 'REJECT' THEN 'closed'
             WHEN UPPER(status) = 'PENDING' THEN 'not_closed'
             ELSE NULL END
      ) = 'closed'
    ) as total_closed,
    -- FIXED: Pending = approved tapi NOT closed
    COUNT(*) FILTER (WHERE 
      COALESCE(approval_status,
        CASE WHEN UPPER(status) IN ('ACC', 'PENDING') THEN 'approved' ELSE NULL END
      ) = 'approved'
      AND
      COALESCE(transaction_status,
        CASE WHEN UPPER(status) = 'ACC' THEN 'closed'
             WHEN UPPER(status) = 'REJECT' THEN 'closed'
             WHEN UPPER(status) = 'PENDING' THEN 'not_closed'
             ELSE NULL END
      ) != 'closed'
    ) as total_pending,
    COUNT(*) FILTER (WHERE 
      transaction_status = 'closed' 
      AND id NOT IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)
    ) as total_closing_direct,
    COUNT(*) FILTER (WHERE 
      transaction_status = 'closed' 
      AND id IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)
    ) as total_closing_followup
  FROM vast_finance_data_new
  WHERE DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', target_month)
    AND deleted_at IS NULL
  GROUP BY created_by_user_id;
END;
$$ LANGUAGE plpgsql;

-- Refresh daily function juga
CREATE OR REPLACE FUNCTION refresh_daily_promoter_aggregates_for_date(target_date DATE)
RETURNS void AS $$
BEGIN
  DELETE FROM agg_daily_promoter WHERE agg_date = target_date;

  INSERT INTO agg_daily_promoter (
    promoter_user_id,
    agg_date,
    total_input,
    total_approved,
    total_rejected,
    total_closed,
    total_pending,
    total_closing_direct,
    total_closing_followup
  )
  SELECT 
    created_by_user_id as promoter_user_id,
    target_date as agg_date,
    COUNT(*) as total_input,
    COUNT(*) FILTER (WHERE 
      COALESCE(approval_status,
        CASE WHEN UPPER(status) IN ('ACC', 'PENDING') THEN 'approved'
             WHEN UPPER(status) = 'REJECT' THEN 'rejected'
             ELSE NULL END
      ) = 'approved'
    ) as total_approved,
    COUNT(*) FILTER (WHERE 
      COALESCE(approval_status,
        CASE WHEN UPPER(status) = 'REJECT' THEN 'rejected' ELSE NULL END
      ) = 'rejected'
    ) as total_rejected,
    COUNT(*) FILTER (WHERE 
      COALESCE(transaction_status,
        CASE WHEN UPPER(status) = 'ACC' THEN 'closed'
             WHEN UPPER(status) = 'REJECT' THEN 'closed'
             WHEN UPPER(status) = 'PENDING' THEN 'not_closed'
             ELSE NULL END
      ) = 'closed'
    ) as total_closed,
    COUNT(*) FILTER (WHERE 
      COALESCE(approval_status,
        CASE WHEN UPPER(status) IN ('ACC', 'PENDING') THEN 'approved' ELSE NULL END
      ) = 'approved'
      AND
      COALESCE(transaction_status,
        CASE WHEN UPPER(status) = 'ACC' THEN 'closed'
             WHEN UPPER(status) = 'REJECT' THEN 'closed'
             WHEN UPPER(status) = 'PENDING' THEN 'not_closed'
             ELSE NULL END
      ) != 'closed'
    ) as total_pending,
    COUNT(*) FILTER (WHERE 
      transaction_status = 'closed' 
      AND id NOT IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)
    ) as total_closing_direct,
    COUNT(*) FILTER (WHERE 
      transaction_status = 'closed' 
      AND id IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)
    ) as total_closing_followup
  FROM vast_finance_data_new
  WHERE DATE(sale_date) = target_date
    AND deleted_at IS NULL
  GROUP BY created_by_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MASALAH 3: SPV DUAL ROLE - VIEW TIDAK MENGHITUNG DIRECT PROMOTOR
-- ============================================================================

-- Drop dan recreate view SATOR untuk include SPV dual role
DROP VIEW IF EXISTS v_agg_monthly_sator_all CASCADE;

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

-- Recreate view SPV untuk include SATOR + Direct Promotor
DROP VIEW IF EXISTS v_agg_monthly_spv_all CASCADE;

CREATE VIEW v_agg_monthly_spv_all AS
WITH sator_totals AS (
    -- Total dari SATOR di bawah SPV
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
    GROUP BY h2.atasan_id, vs.agg_month
),
direct_promotor_totals AS (
    -- FIX: Tambahkan direct promotor di bawah SPV (SPV dual role)
    SELECT
        h.atasan_id AS spv_user_id,
        vp.agg_month,
        SUM(COALESCE(vp.total_input, 0)) AS total_input,
        SUM(COALESCE(vp.total_approved, 0)) AS total_approved,
        SUM(COALESCE(vp.total_rejected, 0)) AS total_rejected,
        SUM(COALESCE(vp.total_closed, 0)) AS total_closed,
        SUM(COALESCE(vp.total_pending, 0)) AS total_pending,
        SUM(COALESCE(vp.total_closing_direct, 0)) AS total_closing_direct,
        SUM(COALESCE(vp.total_closing_followup, 0)) AS total_closing_followup,
        COUNT(DISTINCT vp.promoter_user_id) AS direct_promotor_count
    FROM v_agg_monthly_promoter_all vp
    JOIN hierarchy h ON h.user_id = vp.promoter_user_id
    JOIN users u ON u.id = h.atasan_id AND u.role = 'spv'  -- Hanya jika atasan adalah SPV
    WHERE h.atasan_id IS NOT NULL
      AND NOT EXISTS (
          -- Promotor yang TIDAK punya SATOR sebagai atasan
          SELECT 1 FROM hierarchy h2 
          WHERE h2.user_id = h.user_id 
            AND h2.atasan_id IN (SELECT id FROM users WHERE role = 'sator')
      )
    GROUP BY h.atasan_id, vp.agg_month
)
SELECT
    COALESCE(st.spv_user_id, dpt.spv_user_id) AS spv_user_id,
    COALESCE(st.agg_month, dpt.agg_month) AS agg_month,
    COALESCE(st.total_input, 0) + COALESCE(dpt.total_input, 0) AS total_input,
    COALESCE(st.total_approved, 0) + COALESCE(dpt.total_approved, 0) AS total_approved,
    COALESCE(st.total_rejected, 0) + COALESCE(dpt.total_rejected, 0) AS total_rejected,
    COALESCE(st.total_closed, 0) + COALESCE(dpt.total_closed, 0) AS total_closed,
    COALESCE(st.total_pending, 0) + COALESCE(dpt.total_pending, 0) AS total_pending,
    COALESCE(st.total_closing_direct, 0) + COALESCE(dpt.total_closing_direct, 0) AS total_closing_direct,
    COALESCE(st.total_closing_followup, 0) + COALESCE(dpt.total_closing_followup, 0) AS total_closing_followup,
    COALESCE(st.sator_count, 0) AS sator_count
FROM sator_totals st
FULL OUTER JOIN direct_promotor_totals dpt 
    ON st.spv_user_id = dpt.spv_user_id 
    AND st.agg_month = dpt.agg_month;

-- Recreate view daily SPV juga
DROP VIEW IF EXISTS v_agg_daily_spv_all CASCADE;

CREATE VIEW v_agg_daily_spv_all AS
WITH sator_totals AS (
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
    GROUP BY h2.atasan_id, vs.agg_date
),
direct_promotor_totals AS (
    SELECT
        h.atasan_id AS spv_user_id,
        vp.agg_date,
        SUM(COALESCE(vp.total_input, 0)) AS total_input,
        SUM(COALESCE(vp.total_approved, 0)) AS total_approved,
        SUM(COALESCE(vp.total_rejected, 0)) AS total_rejected,
        SUM(COALESCE(vp.total_closed, 0)) AS total_closed,
        SUM(COALESCE(vp.total_pending, 0)) AS total_pending,
        SUM(COALESCE(vp.total_closing_direct, 0)) AS total_closing_direct,
        SUM(COALESCE(vp.total_closing_followup, 0)) AS total_closing_followup,
        COUNT(DISTINCT vp.promoter_user_id) AS direct_promotor_count
    FROM v_agg_daily_promoter_all vp
    JOIN hierarchy h ON h.user_id = vp.promoter_user_id
    JOIN users u ON u.id = h.atasan_id AND u.role = 'spv'
    WHERE h.atasan_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM hierarchy h2 
          WHERE h2.user_id = h.user_id 
            AND h2.atasan_id IN (SELECT id FROM users WHERE role = 'sator')
      )
    GROUP BY h.atasan_id, vp.agg_date
)
SELECT
    COALESCE(st.spv_user_id, dpt.spv_user_id) AS spv_user_id,
    COALESCE(st.agg_date, dpt.agg_date) AS agg_date,
    COALESCE(st.total_input, 0) + COALESCE(dpt.total_input, 0) AS total_input,
    COALESCE(st.total_approved, 0) + COALESCE(dpt.total_approved, 0) AS total_approved,
    COALESCE(st.total_rejected, 0) + COALESCE(dpt.total_rejected, 0) AS total_rejected,
    COALESCE(st.total_closed, 0) + COALESCE(dpt.total_closed, 0) AS total_closed,
    COALESCE(st.total_pending, 0) + COALESCE(dpt.total_pending, 0) AS total_pending,
    COALESCE(st.total_closing_direct, 0) + COALESCE(dpt.total_closing_direct, 0) AS total_closing_direct,
    COALESCE(st.total_closing_followup, 0) + COALESCE(dpt.total_closing_followup, 0) AS total_closing_followup,
    COALESCE(st.sator_count, 0) AS sator_count
FROM sator_totals st
FULL OUTER JOIN direct_promotor_totals dpt 
    ON st.spv_user_id = dpt.spv_user_id 
    AND st.agg_date = dpt.agg_date;

-- ============================================================================
-- EXECUTE FIX
-- ============================================================================

-- Refresh agregasi bulan ini
SELECT refresh_monthly_promoter_aggregates_for_month((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE);

-- Refresh agregasi hari ini
SELECT refresh_daily_promoter_aggregates_for_date((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE);

-- Refresh agregasi kemarin (jika ada data)
SELECT refresh_daily_promoter_aggregates_for_date(((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE - INTERVAL '1 day')::DATE);

-- ============================================================================
-- VERIFIKASI SETELAH FIX
-- ============================================================================

-- Verifikasi 1: Cek balance Input = P + C + R
SELECT 
    'VERIFIKASI 1: INPUT = PENDING + CLOSED + REJECTED' as test_name,
    total_input as "Total Input",
    (total_pending + total_closed + total_rejected) as "P+C+R",
    total_pending as "Pending",
    total_closed as "Closed", 
    total_rejected as "Rejected",
    CASE 
        WHEN total_input = (total_pending + total_closed + total_rejected) THEN '✅ BALANCE'
        ELSE '❌ MASIH TIDAK BALANCE - Selisih: ' || (total_input - (total_pending + total_closed + total_rejected))
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

-- Verifikasi 2: Cek SPV dual role
SELECT 
    'VERIFIKASI 2: SPV DUAL ROLE (ANFAL)' as test_name,
    spv.spv_user_id,
    u.name as spv_name,
    spv.total_input as "View SPV Total",
    CASE 
        WHEN u.name LIKE '%ANFAL%' AND spv.total_input >= 300 THEN '✅ FIXED'
        WHEN u.name LIKE '%ANFAL%' THEN '❌ MASIH SALAH - Expected ~306'
        ELSE '✅ OK'
    END as status
FROM v_agg_monthly_spv_all spv
JOIN users u ON u.id = spv.spv_user_id
WHERE spv.agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
  AND u.name LIKE '%ANFAL%';

-- Verifikasi 3: Cek data konflik sudah diupdate
SELECT 
    'VERIFIKASI 3: DATA KONFLIK PENDING+CLOSED' as test_name,
    COUNT(*) as jumlah_data_konflik,
    CASE WHEN COUNT(*) = 0 THEN '✅ FIXED' ELSE '❌ MASIH ADA ' || COUNT(*) || ' DATA KONFLIK' END as status
FROM vast_finance_data_new
WHERE deleted_at IS NULL
  AND UPPER(status) = 'PENDING'
  AND approval_status = 'approved'
  AND transaction_status = 'closed';

-- ============================================================================
-- RINGKASAN
-- ============================================================================
SELECT 
    '=== RINGKASAN FIX ===' as info,
    '1. Update 18 data PENDING+CLOSED menjadi ACC' as fix1,
    '2. Perbaiki logika agregasi (gunakan COALESCE bukan OR)' as fix2,
    '3. Fix view SPV untuk menghitung direct promotor' as fix3,
    '4. Refresh semua agregasi' as fix4,
    'Jalankan verifikasi untuk memastikan fix berhasil' as next_step;
