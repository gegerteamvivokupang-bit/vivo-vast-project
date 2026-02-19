-- ============================================================================
-- FIX TRIGGER ISSUES - Store Aggregates & Conversion Trigger
-- ============================================================================
-- Bug #1: Store aggregates selalu refresh hari ini (harus refresh affected date)
-- Bug #2: Conversion trigger FOR EACH STATEMENT (harus FOR EACH ROW)
-- 
-- IMPORTANT: Review SQL ini dulu sebelum execute!
-- BACKUP: Simpan versi lama di BACKUP_OLD_FUNCTIONS.sql
-- ============================================================================

-- ============================================================================
-- BACKUP: Simpan Fungsi Lama (untuk rollback)
-- Uncomment dan save ke file terpisah jika perlu rollback
-- ============================================================================
/*
-- BACKUP refresh_daily_store_aggregates() - OLD VERSION
CREATE OR REPLACE FUNCTION refresh_daily_store_aggregates()
RETURNS void AS $$
BEGIN
  DELETE FROM agg_daily_store WHERE agg_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE;
  INSERT INTO agg_daily_store ( ... )
  SELECT ... 
  FROM vast_finance_data_new
  WHERE DATE(sale_date) = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE
  ...
END;
$$ LANGUAGE plpgsql;

-- Similar for refresh_monthly_store_aggregates() and trigger_refresh_aggregates()
*/

-- ============================================================================
-- STEP 1: Buat Fungsi Baru - Date-Specific Store Aggregates
-- SAFE: Function baru, tidak break yang lama
-- ============================================================================

-- Daily Store Aggregates untuk tanggal tertentu
CREATE OR REPLACE FUNCTION refresh_daily_store_aggregates_for_date(target_date DATE)
RETURNS void AS $$
BEGIN
  -- Delete existing aggregates for specified date
  DELETE FROM agg_daily_store WHERE agg_date = target_date;

  -- Insert fresh aggregates for specified date
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
END;
$$ LANGUAGE plpgsql;

-- Monthly Store Aggregates untuk bulan tertentu
CREATE OR REPLACE FUNCTION refresh_monthly_store_aggregates_for_month(target_month DATE)
RETURNS void AS $$
BEGIN
  -- Delete existing aggregates for specified month
  DELETE FROM agg_monthly_store WHERE agg_month = target_month;

  -- Insert fresh aggregates for specified month
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
    target_month as agg_month,
    COUNT(*) as total_input,
    COUNT(*) FILTER (WHERE approval_status = 'approved') as total_approved,
    COUNT(*) FILTER (WHERE approval_status = 'rejected') as total_rejected,
    COUNT(*) FILTER (WHERE transaction_status = 'closed') as total_closed,
    COUNT(*) FILTER (WHERE approval_status = 'approved' AND transaction_status = 'not_closed') as total_pending,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id NOT IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)) as total_closing_direct,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)) as total_closing_followup
  FROM vast_finance_data_new
  WHERE DATE_TRUNC('month', sale_date) = target_month
    AND deleted_at IS NULL
  GROUP BY store_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: Update Wrapper Functions
-- Update fungsi lama untuk pakai fungsi baru
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_daily_store_aggregates()
RETURNS void AS $$
BEGIN
  -- Now calls the date-specific function for today
  PERFORM refresh_daily_store_aggregates_for_date(
    (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_monthly_store_aggregates()
RETURNS void AS $$
BEGIN
  -- Now calls the month-specific function for this month
  PERFORM refresh_monthly_store_aggregates_for_month(
    DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)::DATE
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 3: Update Trigger Function - Fix Store Aggregates
-- Update trigger untuk call fungsi yang benar (affected date, bukan hari ini)
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_refresh_aggregates()
RETURNS trigger AS $$
DECLARE
    affected_date DATE;
    affected_month DATE;
BEGIN
    -- Determine which date was affected
    IF TG_OP = 'DELETE' THEN
        affected_date := OLD.sale_date::DATE;
    ELSE
        affected_date := NEW.sale_date::DATE;
    END IF;
    
    affected_month := DATE_TRUNC('month', affected_date)::DATE;
    
    -- Refresh aggregates for the AFFECTED date (not just today)
    PERFORM refresh_daily_promoter_aggregates_for_date(affected_date);
    PERFORM refresh_monthly_promoter_aggregates_for_month(affected_month);
    
    -- FIX: Store aggregates juga untuk affected date
    PERFORM refresh_daily_store_aggregates_for_date(affected_date);
    PERFORM refresh_monthly_store_aggregates_for_month(affected_month);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 4: Buat Fungsi Khusus untuk Conversion Trigger
-- Conversion tidak punya sale_date, harus lookup dari transaction
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_refresh_aggregates_conversion()
RETURNS trigger AS $$
DECLARE
    v_transaction_id UUID;
    v_sale_date DATE;
    v_affected_month DATE;
BEGIN
    -- Get transaction_id from NEW or OLD
    IF TG_OP = 'DELETE' THEN
        v_transaction_id := OLD.transaction_id;
    ELSE
        v_transaction_id := NEW.transaction_id;
    END IF;
    
    -- Get sale_date from vast_finance_data_new
    SELECT sale_date::DATE INTO v_sale_date
    FROM vast_finance_data_new
    WHERE id = v_transaction_id
      AND deleted_at IS NULL;
    
    -- Only refresh if we found the transaction
    IF v_sale_date IS NOT NULL THEN
        v_affected_month := DATE_TRUNC('month', v_sale_date)::DATE;
        
        -- Refresh aggregates for the affected date
        PERFORM refresh_daily_promoter_aggregates_for_date(v_sale_date);
        PERFORM refresh_monthly_promoter_aggregates_for_month(v_affected_month);
        PERFORM refresh_daily_store_aggregates_for_date(v_sale_date);
        PERFORM refresh_monthly_store_aggregates_for_month(v_affected_month);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 5: Update Conversion Trigger - Fix FOR EACH STATEMENT → FOR EACH ROW
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_agg_on_conversion ON conversions;
CREATE TRIGGER trigger_agg_on_conversion
  AFTER INSERT OR UPDATE OR DELETE ON conversions
  FOR EACH ROW  -- FIX: ROW bukan STATEMENT!
  EXECUTE FUNCTION trigger_refresh_aggregates_conversion();

-- ============================================================================
-- VERIFICATION QUERIES
-- Jalankan query ini setelah fix untuk verify
-- ============================================================================

-- Test 1: Cek fungsi baru ada
SELECT 
    'refresh_daily_store_aggregates_for_date' as function_name,
    CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM pg_proc 
WHERE proname = 'refresh_daily_store_aggregates_for_date'

UNION ALL

SELECT 
    'refresh_monthly_store_aggregates_for_month',
    CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END
FROM pg_proc 
WHERE proname = 'refresh_monthly_store_aggregates_for_month'

UNION ALL

SELECT 
    'trigger_refresh_aggregates_conversion',
    CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END
FROM pg_proc 
WHERE proname = 'trigger_refresh_aggregates_conversion';

-- Test 2: Cek trigger conversion sudah FOR EACH ROW
SELECT 
    tgname as trigger_name,
    CASE 
        WHEN tgtype = 29 THEN '✅ FOR EACH ROW' 
        WHEN tgtype = 23 THEN '❌ FOR EACH STATEMENT (OLD)'
        ELSE 'Unknown Type'
    END as trigger_type,
    pg_get_triggerdef(oid) as definition
FROM pg_trigger 
WHERE tgname = 'trigger_agg_on_conversion';

-- ============================================================================
-- FUNCTIONAL TEST (Execute setelah fix)
-- ============================================================================

-- Test Case 1: Insert data kemarin, cek store aggregate kemarin ter-update
DO $$
DECLARE
    v_yesterday DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE - INTERVAL '1 day';
    v_store_count INTEGER;
BEGIN
    -- Manual call fungsi baru untuk kemarin
    PERFORM refresh_daily_store_aggregates_for_date(v_yesterday);
    
    -- Cek apakah ada data
    SELECT COUNT(*) INTO v_store_count
    FROM agg_daily_store
    WHERE agg_date = v_yesterday;
    
    RAISE NOTICE 'Store aggregates untuk kemarin: % rows', v_store_count;
    RAISE NOTICE 'Expected: >0 jika ada data kemarin';
END $$;

-- Test Case 2: Cek promoter aggregates masih jalan (tidak broken)
DO $$
DECLARE
    v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE;
    v_promoter_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_promoter_count
    FROM agg_daily_promoter
    WHERE agg_date = v_today;
    
    RAISE NOTICE 'Promoter aggregates hari ini: % rows', v_promoter_count;
    RAISE NOTICE 'Expected: >0 jika ada data hari ini';
END $$;

-- ============================================================================
-- ROLLBACK SCRIPT (If needed)
-- Copy paste code di bagian BACKUP di atas untuk rollback
-- ============================================================================
/*
-- Untuk rollback:
-- 1. Backup file ini
-- 2. Restore versi lama dari migration file
-- 3. Re-run migration file yang lama
*/

-- ============================================================================
-- SUMMARY
-- ============================================================================
SELECT 
    '=== FIX COMPLETED ===' as status,
    'Kedua bug sudah di-fix:' as info;

SELECT 
    '1. Store aggregates sekarang refresh affected date (bukan hari ini)' as fix_1
UNION ALL
SELECT 
    '2. Conversion trigger sekarang FOR EACH ROW (bukan STATEMENT)' as fix_2
UNION ALL
SELECT 
    '3. Silakan jalankan VERIFICATION QUERIES dan FUNCTIONAL TEST di atas' as next_step;
