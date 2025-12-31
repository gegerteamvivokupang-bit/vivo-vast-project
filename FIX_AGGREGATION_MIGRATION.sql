-- ============================================================================
-- FIX AGGREGATION UNTUK DATA MIGRASI
-- Problem: Fungsi refresh hanya untuk hari ini, data migrasi tanggal lampau tidak ter-aggregate
-- Solution: Buat fungsi yang bisa refresh untuk range tanggal tertentu
-- ============================================================================

-- ============================================
-- FUNCTION: Refresh Daily Promoter untuk tanggal TERTENTU
-- ============================================
CREATE OR REPLACE FUNCTION refresh_daily_promoter_for_date(target_date DATE)
RETURNS void AS $$
BEGIN
  -- Delete existing aggregates for target date
  DELETE FROM agg_daily_promoter WHERE agg_date = target_date;

  -- Insert fresh aggregates for target date
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
    COUNT(*) FILTER (WHERE approval_status = 'approved') as total_approved,
    COUNT(*) FILTER (WHERE approval_status = 'rejected') as total_rejected,
    COUNT(*) FILTER (WHERE transaction_status = 'closed') as total_closed,
    COUNT(*) FILTER (WHERE approval_status = 'approved' AND transaction_status = 'not_closed') as total_pending,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id NOT IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)) as total_closing_direct,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)) as total_closing_followup
  FROM vast_finance_data_new
  WHERE DATE(sale_date) = target_date
    AND deleted_at IS NULL
  GROUP BY created_by_user_id;
  
  RAISE NOTICE 'Refreshed daily promoter aggregates for %', target_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Refresh Monthly Promoter untuk BULAN tertentu
-- ============================================
CREATE OR REPLACE FUNCTION refresh_monthly_promoter_for_month(target_month DATE)
RETURNS void AS $$
DECLARE
  month_start DATE := DATE_TRUNC('month', target_month);
BEGIN
  -- Delete existing aggregates for target month
  DELETE FROM agg_monthly_promoter WHERE agg_month = month_start;

  -- Insert fresh aggregates for target month
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
    month_start as agg_month,
    COUNT(*) as total_input,
    COUNT(*) FILTER (WHERE approval_status = 'approved') as total_approved,
    COUNT(*) FILTER (WHERE approval_status = 'rejected') as total_rejected,
    COUNT(*) FILTER (WHERE transaction_status = 'closed') as total_closed,
    COUNT(*) FILTER (WHERE approval_status = 'approved' AND transaction_status = 'not_closed') as total_pending,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id NOT IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)) as total_closing_direct,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)) as total_closing_followup
  FROM vast_finance_data_new
  WHERE DATE_TRUNC('month', sale_date) = month_start
    AND deleted_at IS NULL
  GROUP BY created_by_user_id;
  
  RAISE NOTICE 'Refreshed monthly promoter aggregates for %', month_start;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Refresh Daily Store untuk tanggal TERTENTU
-- ============================================
CREATE OR REPLACE FUNCTION refresh_daily_store_for_date(target_date DATE)
RETURNS void AS $$
BEGIN
  DELETE FROM agg_daily_store WHERE agg_date = target_date;

  INSERT INTO agg_daily_store (
    store_id,
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
    store_id,
    target_date as agg_date,
    COUNT(*) as total_input,
    COUNT(*) FILTER (WHERE approval_status = 'approved') as total_approved,
    COUNT(*) FILTER (WHERE approval_status = 'rejected') as total_rejected,
    COUNT(*) FILTER (WHERE transaction_status = 'closed') as total_closed,
    COUNT(*) FILTER (WHERE approval_status = 'approved' AND transaction_status = 'not_closed') as total_pending,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id NOT IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)) as total_closing_direct,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)) as total_closing_followup
  FROM vast_finance_data_new
  WHERE DATE(sale_date) = target_date
    AND deleted_at IS NULL
  GROUP BY store_id;
  
  RAISE NOTICE 'Refreshed daily store aggregates for %', target_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Refresh Monthly Store untuk BULAN tertentu
-- ============================================
CREATE OR REPLACE FUNCTION refresh_monthly_store_for_month(target_month DATE)
RETURNS void AS $$
DECLARE
  month_start DATE := DATE_TRUNC('month', target_month);
BEGIN
  DELETE FROM agg_monthly_store WHERE agg_month = month_start;

  INSERT INTO agg_monthly_store (
    store_id,
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
    store_id,
    month_start as agg_month,
    COUNT(*) as total_input,
    COUNT(*) FILTER (WHERE approval_status = 'approved') as total_approved,
    COUNT(*) FILTER (WHERE approval_status = 'rejected') as total_rejected,
    COUNT(*) FILTER (WHERE transaction_status = 'closed') as total_closed,
    COUNT(*) FILTER (WHERE approval_status = 'approved' AND transaction_status = 'not_closed') as total_pending,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id NOT IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)) as total_closing_direct,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)) as total_closing_followup
  FROM vast_finance_data_new
  WHERE DATE_TRUNC('month', sale_date) = month_start
    AND deleted_at IS NULL
  GROUP BY store_id;
  
  RAISE NOTICE 'Refreshed monthly store aggregates for %', month_start;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Refresh SEMUA aggregasi untuk DATE RANGE
-- Untuk migrasi data bulk!
-- ============================================
CREATE OR REPLACE FUNCTION refresh_all_aggregates_for_range(start_date DATE, end_date DATE)
RETURNS void AS $$
DECLARE
  current_date_iter DATE := start_date;
BEGIN
  -- Loop through each date and refresh
  WHILE current_date_iter <= end_date LOOP
    PERFORM refresh_daily_promoter_for_date(current_date_iter);
    PERFORM refresh_daily_store_for_date(current_date_iter);
    current_date_iter := current_date_iter + 1;
  END LOOP;
  
  -- Refresh monthly (just once for December 2025)
  PERFORM refresh_monthly_promoter_for_month(start_date);
  PERFORM refresh_monthly_store_for_month(start_date);
  
  RAISE NOTICE 'Completed refreshing all aggregates from % to %', start_date, end_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SEKARANG: REFRESH DATA 26-30 DESEMBER 2025
-- ============================================
SELECT refresh_all_aggregates_for_range('2025-12-26'::DATE, '2025-12-30'::DATE);

-- ============================================
-- VERIFY: Cek data sudah masuk ke tabel aggregasi
-- ============================================
SELECT 
    agg_date,
    COUNT(*) AS promotor_count,
    SUM(total_input) AS total_input,
    SUM(total_closed) AS total_closed
FROM agg_daily_promoter
WHERE agg_date >= '2025-12-26'
GROUP BY agg_date
ORDER BY agg_date;

-- Cek view juga sekarang harusnya ada data
SELECT 
    agg_date,
    COUNT(*) AS promotor_count,
    SUM(total_input) AS total_input
FROM v_agg_daily_promoter_all
WHERE agg_date >= '2025-12-26'
GROUP BY agg_date
ORDER BY agg_date;
