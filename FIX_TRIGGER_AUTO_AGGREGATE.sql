-- ============================================================================
-- FIX TRIGGER: Auto-refresh aggregates berdasarkan SALE_DATE data
-- Bukan hanya hari ini!
-- ============================================================================

-- ============================================
-- TRIGGER FUNCTION: Smarter refresh based on actual sale_date
-- ============================================
CREATE OR REPLACE FUNCTION trigger_refresh_aggregates()
RETURNS trigger AS $$
DECLARE
  affected_date DATE;
  affected_month DATE;
BEGIN
  -- Determine affected date from the row data
  IF TG_OP = 'DELETE' THEN
    affected_date := DATE(OLD.sale_date);
  ELSE
    affected_date := DATE(NEW.sale_date);
  END IF;
  
  affected_month := DATE_TRUNC('month', affected_date);
  
  -- ============================================
  -- REFRESH DAILY PROMOTER for affected date
  -- ============================================
  DELETE FROM agg_daily_promoter WHERE agg_date = affected_date;
  
  INSERT INTO agg_daily_promoter (
    promoter_user_id, agg_date, total_input, total_approved, total_rejected, 
    total_closed, total_pending, total_closing_direct, total_closing_followup
  )
  SELECT 
    created_by_user_id,
    affected_date,
    COUNT(*),
    COUNT(*) FILTER (WHERE approval_status = 'approved'),
    COUNT(*) FILTER (WHERE approval_status = 'rejected'),
    COUNT(*) FILTER (WHERE transaction_status = 'closed'),
    COUNT(*) FILTER (WHERE approval_status = 'approved' AND transaction_status = 'not_closed'),
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id NOT IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)),
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL))
  FROM vast_finance_data_new
  WHERE DATE(sale_date) = affected_date AND deleted_at IS NULL
  GROUP BY created_by_user_id;

  -- ============================================
  -- REFRESH DAILY STORE for affected date
  -- ============================================
  DELETE FROM agg_daily_store WHERE agg_date = affected_date;
  
  INSERT INTO agg_daily_store (
    store_id, agg_date, total_input, total_approved, total_rejected,
    total_closed, total_pending, total_closing_direct, total_closing_followup
  )
  SELECT 
    store_id,
    affected_date,
    COUNT(*),
    COUNT(*) FILTER (WHERE approval_status = 'approved'),
    COUNT(*) FILTER (WHERE approval_status = 'rejected'),
    COUNT(*) FILTER (WHERE transaction_status = 'closed'),
    COUNT(*) FILTER (WHERE approval_status = 'approved' AND transaction_status = 'not_closed'),
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id NOT IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)),
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL))
  FROM vast_finance_data_new
  WHERE DATE(sale_date) = affected_date AND deleted_at IS NULL
  GROUP BY store_id;

  -- ============================================
  -- REFRESH MONTHLY PROMOTER for affected month
  -- ============================================
  DELETE FROM agg_monthly_promoter WHERE agg_month = affected_month;
  
  INSERT INTO agg_monthly_promoter (
    promoter_user_id, agg_month, total_input, total_approved, total_rejected,
    total_closed, total_pending, total_closing_direct, total_closing_followup
  )
  SELECT 
    created_by_user_id,
    affected_month,
    COUNT(*),
    COUNT(*) FILTER (WHERE approval_status = 'approved'),
    COUNT(*) FILTER (WHERE approval_status = 'rejected'),
    COUNT(*) FILTER (WHERE transaction_status = 'closed'),
    COUNT(*) FILTER (WHERE approval_status = 'approved' AND transaction_status = 'not_closed'),
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id NOT IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)),
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL))
  FROM vast_finance_data_new
  WHERE DATE_TRUNC('month', sale_date) = affected_month AND deleted_at IS NULL
  GROUP BY created_by_user_id;

  -- ============================================
  -- REFRESH MONTHLY STORE for affected month
  -- ============================================
  DELETE FROM agg_monthly_store WHERE agg_month = affected_month;
  
  INSERT INTO agg_monthly_store (
    store_id, agg_month, total_input, total_approved, total_rejected,
    total_closed, total_pending, total_closing_direct, total_closing_followup
  )
  SELECT 
    store_id,
    affected_month,
    COUNT(*),
    COUNT(*) FILTER (WHERE approval_status = 'approved'),
    COUNT(*) FILTER (WHERE approval_status = 'rejected'),
    COUNT(*) FILTER (WHERE transaction_status = 'closed'),
    COUNT(*) FILTER (WHERE approval_status = 'approved' AND transaction_status = 'not_closed'),
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id NOT IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)),
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL))
  FROM vast_finance_data_new
  WHERE DATE_TRUNC('month', sale_date) = affected_month AND deleted_at IS NULL
  GROUP BY store_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RE-CREATE TRIGGER dengan FOR EACH ROW
-- Agar bisa akses NEW.sale_date
-- ============================================
DROP TRIGGER IF EXISTS trigger_agg_on_submission ON vast_finance_data_new;
CREATE TRIGGER trigger_agg_on_submission
  AFTER INSERT OR UPDATE OR DELETE ON vast_finance_data_new
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_aggregates();

-- ============================================
-- TRIGGER untuk conversions (tetap FOR EACH STATEMENT)
-- ============================================
DROP TRIGGER IF EXISTS trigger_agg_on_conversion ON conversions;

CREATE OR REPLACE FUNCTION trigger_refresh_on_conversion()
RETURNS trigger AS $$
DECLARE
  affected_date DATE;
  affected_month DATE;
  txn_id UUID;
BEGIN
  -- Get transaction_id
  IF TG_OP = 'DELETE' THEN
    txn_id := OLD.transaction_id;
  ELSE
    txn_id := NEW.transaction_id;
  END IF;
  
  -- Get sale_date from the transaction
  SELECT DATE(sale_date), DATE_TRUNC('month', sale_date) 
  INTO affected_date, affected_month
  FROM vast_finance_data_new 
  WHERE id = txn_id;
  
  IF affected_date IS NOT NULL THEN
    -- Refresh daily aggregates
    DELETE FROM agg_daily_promoter WHERE agg_date = affected_date;
    INSERT INTO agg_daily_promoter (promoter_user_id, agg_date, total_input, total_approved, total_rejected, total_closed, total_pending, total_closing_direct, total_closing_followup)
    SELECT created_by_user_id, affected_date, COUNT(*),
           COUNT(*) FILTER (WHERE approval_status = 'approved'),
           COUNT(*) FILTER (WHERE approval_status = 'rejected'),
           COUNT(*) FILTER (WHERE transaction_status = 'closed'),
           COUNT(*) FILTER (WHERE approval_status = 'approved' AND transaction_status = 'not_closed'),
           COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id NOT IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)),
           COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL))
    FROM vast_finance_data_new WHERE DATE(sale_date) = affected_date AND deleted_at IS NULL
    GROUP BY created_by_user_id;
    
    -- Refresh monthly
    DELETE FROM agg_monthly_promoter WHERE agg_month = affected_month;
    INSERT INTO agg_monthly_promoter (promoter_user_id, agg_month, total_input, total_approved, total_rejected, total_closed, total_pending, total_closing_direct, total_closing_followup)
    SELECT created_by_user_id, affected_month, COUNT(*),
           COUNT(*) FILTER (WHERE approval_status = 'approved'),
           COUNT(*) FILTER (WHERE approval_status = 'rejected'),
           COUNT(*) FILTER (WHERE transaction_status = 'closed'),
           COUNT(*) FILTER (WHERE approval_status = 'approved' AND transaction_status = 'not_closed'),
           COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id NOT IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)),
           COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL))
    FROM vast_finance_data_new WHERE DATE_TRUNC('month', sale_date) = affected_month AND deleted_at IS NULL
    GROUP BY created_by_user_id;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agg_on_conversion
  AFTER INSERT OR UPDATE OR DELETE ON conversions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_on_conversion();

-- ============================================
-- VERIFY trigger sudah terpasang
-- ============================================
SELECT tgname, tgrelid::regclass, tgtype 
FROM pg_trigger 
WHERE tgname LIKE 'trigger_agg%';
