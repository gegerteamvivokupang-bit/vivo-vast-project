-- ================================================================
-- PERBAIKAN DATA & LOGIC SPV (DUAL ROLE)
-- Created: 2026-02-19
-- ================================================================

-- 1. FIX DATA INKONSISTEN (18 Baris)
-- Masalah: Status 'pending' tapi approved & closed.
-- Solusi: Ubah ke 'acc' agar perhitungan konsisten.
UPDATE vast_finance_data_new
SET status = 'acc'
WHERE approval_status = 'approved'
  AND transaction_status = 'closed'
  AND status = 'pending';

-- 2. FIX VIEW SPV BULANAN (Handle Dual Role)
-- Masalah: SPV yang punya promotor langsung (Anfal/Willy) tidak terhitung.
-- Solusi: Tambahkan UNION ALL untuk mengambil data diri sendiri sebagai SATOR.

DROP VIEW IF EXISTS v_agg_monthly_spv_all;

CREATE OR REPLACE VIEW v_agg_monthly_spv_all AS
WITH combined_data AS (
    -- A. Data dari SATOR bawahan (Logic Lama)
    SELECT
        h.atasan_id AS spv_user_id,
        vs.agg_month,
        vs.total_input,
        vs.total_approved,
        vs.total_rejected,
        vs.total_closed,
        vs.total_pending,
        vs.total_closing_direct,
        vs.total_closing_followup,
        vs.sator_user_id
    FROM v_agg_monthly_sator_all vs
    JOIN hierarchy h ON h.user_id = vs.sator_user_id
    WHERE h.atasan_id IS NOT NULL

    UNION ALL

    -- B. Data dari SPV itu sendiri yang bertindak sebagai SATOR (Direct Promotor)
    -- Ini akan mengambil angka 171 (Anfal) dan 57 (Wilibrodus) yang sebelumnya hilang
    SELECT
        vs.sator_user_id AS spv_user_id,
        vs.agg_month,
        vs.total_input,
        vs.total_approved,
        vs.total_rejected,
        vs.total_closed,
        vs.total_pending,
        vs.total_closing_direct,
        vs.total_closing_followup,
        vs.sator_user_id
    FROM v_agg_monthly_sator_all vs
)
SELECT
    spv_user_id,
    agg_month,
    SUM(total_input) AS total_input,
    SUM(total_approved) AS total_approved,
    SUM(total_rejected) AS total_rejected,
    SUM(total_closed) AS total_closed,
    SUM(total_pending) AS total_pending,
    SUM(total_closing_direct) AS total_closing_direct,
    SUM(total_closing_followup) AS total_closing_followup,
    COUNT(DISTINCT sator_user_id) AS sator_count
FROM combined_data
GROUP BY spv_user_id, agg_month;

-- 3. FIX VIEW SPV HARIAN (Handle Dual Role)
-- (Sama seperti bulanan, tapi per tanggal)

DROP VIEW IF EXISTS v_agg_daily_spv_all;

CREATE OR REPLACE VIEW v_agg_daily_spv_all AS
WITH combined_data AS (
    -- A. Data dari SATOR bawahan
    SELECT
        h.atasan_id AS spv_user_id,
        vs.agg_date,
        vs.total_input,
        vs.total_approved,
        vs.total_rejected,
        vs.total_closed,
        vs.total_pending,
        vs.total_closing_direct,
        vs.total_closing_followup,
        vs.sator_user_id
    FROM v_agg_daily_sator_all vs
    JOIN hierarchy h ON h.user_id = vs.sator_user_id
    WHERE h.atasan_id IS NOT NULL

    UNION ALL

    -- B. Data SPV sebagai SATOR (Direct)
    SELECT
        vs.sator_user_id AS spv_user_id,
        vs.agg_date,
        vs.total_input,
        vs.total_approved,
        vs.total_rejected,
        vs.total_closed,
        vs.total_pending,
        vs.total_closing_direct,
        vs.total_closing_followup,
        vs.sator_user_id
    FROM v_agg_daily_sator_all vs
)
SELECT
    spv_user_id,
    agg_date,
    SUM(total_input) AS total_input,
    SUM(total_approved) AS total_approved,
    SUM(total_rejected) AS total_rejected,
    SUM(total_closed) AS total_closed,
    SUM(total_pending) AS total_pending,
    SUM(total_closing_direct) AS total_closing_direct,
    SUM(total_closing_followup) AS total_closing_followup,
    COUNT(DISTINCT sator_user_id) AS sator_count
FROM combined_data
GROUP BY spv_user_id, agg_date;

