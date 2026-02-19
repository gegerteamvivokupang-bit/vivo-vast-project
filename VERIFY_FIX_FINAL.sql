-- ======================================================
-- FINAL VERIFICATION (POST-FIX)
-- ======================================================

-- 1. CEK HASIL PERBAIKAN SPV DUAL ROLE (ANFAL & WILLY)
-- Target:
-- Anfal (SATOR=135) + (Direct=171) = 306
-- Wilibrodus (SATOR=179) + (Direct=57) = 236

SELECT 
    '1. CEK DUAL ROLE' as test_name,
    v.spv_user_id,
    u.name as spv_name,
    v.total_input as "CURRENT TOTAL (View)",
    CASE 
        WHEN u.name LIKE '%ANFAL%' THEN 306  -- Harapan
        WHEN u.name LIKE '%WILIBRODUS%' THEN 236 -- Harapan
        ELSE v.total_input 
    END as "EXPECTED TOTAL",
    CASE 
        WHEN u.name LIKE '%ANFAL%' AND v.total_input = 306 THEN '✅ FIXED'
        WHEN u.name LIKE '%WILIBRODUS%' AND v.total_input = 236 THEN '✅ FIXED'
        WHEN u.name LIKE '%ANFAL%' THEN '❌ MASIH SALAH'
        WHEN u.name LIKE '%WILIBRODUS%' THEN '❌ MASIH SALAH'
        ELSE '✅ OK'
    END as status
FROM v_agg_monthly_spv_all v
JOIN users u ON u.id = v.spv_user_id
WHERE u.name LIKE '%ANFAL%' OR u.name LIKE '%WILIBRODUS%';


-- 2. CEK KONSISTENSI TOTAL STATUS (Untuk pastikan -7 selisih hilang)
-- Input (788) harus sama dengan Pending + Closed + Rejected

WITH status_counts AS (
    SELECT
        COUNT(*) as total_real,
        COUNT(*) FILTER (WHERE approval_status = 'approved' AND transaction_status = 'not_closed' OR status = 'pending') as pending,
        COUNT(*) FILTER (WHERE transaction_status = 'closed' OR status = 'acc') as closed,
        COUNT(*) FILTER (WHERE approval_status = 'rejected' OR status = 'reject') as rejected
    FROM vast_finance_data_new
    WHERE deleted_at IS NULL
)
SELECT 
    '2. CEK BALANCE STATUS' as test_name,
    total_real as "Total Input",
    (pending + closed + rejected) as "Sum of Status",
    pending as "Pending",
    closed as "Closed",
    rejected as "Rejected",
    CASE 
        WHEN total_real = (pending + closed + rejected) THEN '✅ BALANCE (No Selisih)'
        ELSE '❌ TIDAK BALANCE (Masih Selisih)'
    END as status
FROM status_counts;


-- 3. CEK APAKAH MASIH ADA DATA HANTU (Pending tapi Closed)
-- Seharusnya 0 baris

SELECT 
    '3. CEK DATA KONFLIK' as test_name,
    count(*) as "Jumlah Data Konflik",
    CASE WHEN count(*) = 0 THEN '✅ BERSIH' ELSE '❌ MASIH ADA' END as status
FROM vast_finance_data_new
WHERE approval_status = 'approved'
  AND transaction_status = 'closed'
  AND status = 'pending';
