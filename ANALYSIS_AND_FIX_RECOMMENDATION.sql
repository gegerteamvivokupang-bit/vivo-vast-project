-- ============================================================================
-- VAST FINANCE - ANALISIS MASALAH DAN REKOMENDASI FIX
-- Created: 2026-02-19
-- ============================================================================

-- ============================================================================
-- IDENTIFIKASI MASALAH UTAMA
-- ============================================================================

-- MASALAH 1: LOGIKA AGREGASI YANG TIDAK KONSISTEN
-- ---------------------------------------------------------------------------
-- Di file create_aggregation_functions.sql, logika perhitungan adalah:
--
-- total_approved = COUNT(*) FILTER (WHERE approval_status = 'approved' OR UPPER(status) = 'ACC')
-- total_rejected = COUNT(*) FILTER (WHERE approval_status = 'rejected' OR UPPER(status) = 'REJECT')
-- total_closed   = COUNT(*) FILTER (WHERE transaction_status = 'closed' OR UPPER(status) = 'ACC')
-- total_pending  = COUNT(*) FILTER (WHERE (approval_status = 'approved' AND transaction_status = 'not_closed') OR UPPER(status) = 'PENDING')
--
-- MASALAH:
-- 1. Jika data memiliki status='ACC' DAN approval_status='approved', akan dihitung 2x di total_approved
-- 2. Jika data memiliki status='ACC' DAN transaction_status='closed', akan dihitung 2x di total_closed
-- 3. Jika data memiliki status='PENDING' DAN (approval_status='approved' AND transaction_status='not_closed'), 
--    akan dihitung 2x di total_pending
--
-- INI MENYEBABKAN:
-- total_input != total_pending + total_rejected + total_closed
-- ---------------------------------------------------------------------------

-- MASALAH 2: VIEW UNION ALL DENGAN DATA LAMA
-- ---------------------------------------------------------------------------
-- View v_agg_monthly_promoter_all menggunakan UNION ALL antara:
-- 1. agg_monthly_promoter (data baru dengan logika baru)
-- 2. vast_finance_data_old (data lama dengan logika berbeda)
--
-- Data lama hanya menggunakan kolom 'status' (ACC, REJECT, PENDING)
-- Sedangkan data baru menggunakan approval_status dan transaction_status
--
-- MASALAH:
-- Jika ada ID mapping yang salah, data bisa terhitung ganda
-- ---------------------------------------------------------------------------

-- MASALAH 3: PERHITUNGAN SATOR DAN SPV DARI VIEW
-- ---------------------------------------------------------------------------
-- View v_agg_monthly_sator_all dan v_agg_monthly_spv_all menghitung 
-- dengan menjumlahkan dari view promotor.
--
-- Jika view promotor sudah salah (double counting), maka view sator dan spv
-- juga akan salah, dan error akan menjalar ke atas.
--
-- MASALAH TAMBAHAN:
-- SPV dual role (SPV yang juga SATOR) memiliki 2 sumber data:
-- 1. Data dari SATOR di bawahnya
-- 2. Data dari promotor langsung di bawahnya
-- Ini memerlukan penanganan khusus di get_manager_monthly_hierarchy
-- ---------------------------------------------------------------------------


-- ============================================================================
-- REKOMENDASI FIX
-- ============================================================================

-- FIX 1: NORMALISASI STATUS DATA
-- Pastikan semua data memiliki nilai yang konsisten
-- ---------------------------------------------------------------------------

-- Update data yang tidak konsisten
UPDATE vast_finance_data_new
SET 
    approval_status = CASE 
        WHEN UPPER(status) = 'ACC' THEN 'approved'
        WHEN UPPER(status) = 'REJECT' THEN 'rejected'
        WHEN UPPER(status) = 'PENDING' THEN 'approved'
        ELSE approval_status
    END,
    transaction_status = CASE 
        WHEN UPPER(status) = 'ACC' THEN 'closed'
        WHEN UPPER(status) = 'REJECT' THEN 'closed'
        WHEN UPPER(status) = 'PENDING' THEN 'not_closed'
        ELSE transaction_status
    END
WHERE deleted_at IS NULL
  AND (
    (UPPER(status) = 'ACC' AND (approval_status IS NULL OR approval_status != 'approved'))
    OR (UPPER(status) = 'REJECT' AND (approval_status IS NULL OR approval_status != 'rejected'))
    OR (UPPER(status) = 'PENDING' AND (transaction_status IS NULL OR transaction_status != 'not_closed'))
  );


-- FIX 2: PERBAIKI LOGIKA AGREGASI
-- Gunakan logika yang lebih tepat dengan exclusive counting
-- ---------------------------------------------------------------------------

-- Drop dan recreate aggregation functions dengan logika yang lebih baik
CREATE OR REPLACE FUNCTION refresh_monthly_promoter_aggregates_for_month_v2(target_month DATE)
RETURNS void AS $$
BEGIN
  DELETE FROM agg_monthly_promoter WHERE agg_month = DATE_TRUNC('month', target_month);

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
    -- Logika baru: prioritas approval_status jika ada, fallback ke status
    COUNT(*) FILTER (WHERE 
      COALESCE(approval_status, 
        CASE WHEN UPPER(status) = 'ACC' THEN 'approved'
             WHEN UPPER(status) = 'REJECT' THEN 'rejected'
             ELSE NULL END
      ) = 'approved'
    ) as total_approved,
    COUNT(*) FILTER (WHERE 
      COALESCE(approval_status, 
        CASE WHEN UPPER(status) = 'REJECT' THEN 'rejected' ELSE NULL END
      ) = 'rejected'
    ) as total_rejected,
    -- Logika baru: prioritas transaction_status jika ada, fallback ke status
    COUNT(*) FILTER (WHERE 
      COALESCE(transaction_status, 
        CASE WHEN UPPER(status) = 'ACC' THEN 'closed' ELSE NULL END
      ) = 'closed'
    ) as total_closed,
    -- Pending = approved tapi belum closed
    COUNT(*) FILTER (WHERE 
      (COALESCE(approval_status, 
        CASE WHEN UPPER(status) IN ('ACC', 'PENDING') THEN 'approved' ELSE NULL END
      ) = 'approved')
      AND
      (COALESCE(transaction_status, 
        CASE WHEN UPPER(status) = 'PENDING' THEN 'not_closed' ELSE NULL END
      ) = 'not_closed' OR transaction_status IS NULL)
    ) as total_pending,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id NOT IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)) as total_closing_direct,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)) as total_closing_followup
  FROM vast_finance_data_new
  WHERE DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', target_month)
    AND deleted_at IS NULL
  GROUP BY created_by_user_id;
END;
$$ LANGUAGE plpgsql;


-- FIX 3: REFRESH SEMUA AGREGASI
-- Setelah normalisasi, jalankan refresh agregasi
-- ---------------------------------------------------------------------------

-- Refresh untuk bulan ini
SELECT refresh_monthly_promoter_aggregates_for_month_v2((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE);

-- Refresh untuk bulan lalu (jika perlu)
SELECT refresh_monthly_promoter_aggregates_for_month_v2(((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE - INTERVAL '1 month')::DATE);


-- ============================================================================
-- VERIFIKASI SETELAH FIX
-- ============================================================================

-- Cek apakah total_input = pending + closed + rejected
SELECT 
    'VERIFIKASI SETELAH FIX' as test,
    total_input as "Total Input",
    (total_pending + total_closed + total_rejected) as "P+C+R",
    total_pending as "Pending",
    total_closed as "Closed", 
    total_rejected as "Rejected",
    CASE 
        WHEN total_input = (total_pending + total_closed + total_rejected) THEN '✅ BALANCE'
        ELSE '❌ MASIH TIDAK BALANCE'
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
-- CATATAN PENTING
-- ============================================================================
/*
RINGKASAN MASALAH:

1. KETIDAKKONSISTENAN STATUS COLUMNS
   - Ada 3 kolom: status, approval_status, transaction_status
   - Logika agregasi menggunakan OR yang menyebabkan double counting
   - Contoh: data dengan status='ACC' DAN transaction_status='closed' 
     akan dihitung 2x di total_closed

2. HIERARKI AGREGASI YANG MENJALAR
   - Promotor → SATOR → SPV → Manager
   - Jika perhitungan di level Promotor salah, error akan menjalar ke atas
   - SPV dual role menambah kompleksitas

3. VIEW UNION ALL DENGAN DATA LAMA
   - v_agg_monthly_promoter_all = UNION ALL (agg_monthly_promoter + vast_finance_data_old)
   - Bisa menyebabkan duplikasi jika ID mapping tidak benar

LANGKAH FIX:

1. Normalisasi status data (UPDATE query di atas)
2. Perbaiki logika agregasi dengan COALESCE dan prioritas yang jelas
3. Refresh agregasi untuk semua bulan yang terdampak
4. Verifikasi hasil dengan query balance check

PREVENTION:

1. Tambahkan constraint atau trigger untuk memastikan konsistensi status
2. Buat validasi sebelum insert/update data
3. Monitoring otomatis untuk cek balance agregasi
*/
