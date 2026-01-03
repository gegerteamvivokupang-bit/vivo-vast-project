-- VAST FINANCE - Aggregation Functions
-- Auto-populate agg_daily_promoter, agg_monthly_promoter, agg_daily_store, agg_monthly_store
-- Triggered on INSERT/UPDATE/DELETE to vast_finance_data_new and conversions
-- UPDATED: 2026-01-03 - Added date-specific functions for accurate historical data

-- ============================================
-- FUNCTION: Refresh Daily Promoter Aggregates FOR SPECIFIC DATE
-- This is the core function - can refresh any date
-- ============================================
CREATE OR REPLACE FUNCTION refresh_daily_promoter_aggregates_for_date(target_date DATE)
RETURNS void AS $$
BEGIN
  -- Delete existing aggregates for specified date
  DELETE FROM agg_daily_promoter WHERE agg_date = target_date;

  -- Insert fresh aggregates for specified date
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
    COUNT(*) FILTER (WHERE approval_status = 'approved' OR UPPER(status) = 'ACC') as total_approved,
    COUNT(*) FILTER (WHERE approval_status = 'rejected' OR UPPER(status) = 'REJECT') as total_rejected,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' OR UPPER(status) = 'ACC') as total_closed,
    COUNT(*) FILTER (WHERE (approval_status = 'approved' AND transaction_status = 'not_closed') OR UPPER(status) = 'PENDING') as total_pending,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id NOT IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)) as total_closing_direct,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)) as total_closing_followup
  FROM vast_finance_data_new
  WHERE DATE(sale_date) = target_date
    AND deleted_at IS NULL
  GROUP BY created_by_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Refresh Daily Promoter Aggregates (wrapper for TODAY)
-- ============================================
CREATE OR REPLACE FUNCTION refresh_daily_promoter_aggregates()
RETURNS void AS $$
BEGIN
  PERFORM refresh_daily_promoter_aggregates_for_date((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Refresh Monthly Promoter Aggregates FOR SPECIFIC MONTH
-- ============================================
CREATE OR REPLACE FUNCTION refresh_monthly_promoter_aggregates_for_month(target_month DATE)
RETURNS void AS $$
BEGIN
  -- Delete existing aggregates for specified month
  DELETE FROM agg_monthly_promoter WHERE agg_month = DATE_TRUNC('month', target_month);

  -- Insert fresh aggregates for specified month
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
    COUNT(*) FILTER (WHERE approval_status = 'approved' OR UPPER(status) = 'ACC') as total_approved,
    COUNT(*) FILTER (WHERE approval_status = 'rejected' OR UPPER(status) = 'REJECT') as total_rejected,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' OR UPPER(status) = 'ACC') as total_closed,
    COUNT(*) FILTER (WHERE (approval_status = 'approved' AND transaction_status = 'not_closed') OR UPPER(status) = 'PENDING') as total_pending,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id NOT IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)) as total_closing_direct,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)) as total_closing_followup
  FROM vast_finance_data_new
  WHERE DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', target_month)
    AND deleted_at IS NULL
  GROUP BY created_by_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Refresh Monthly Promoter Aggregates (wrapper for THIS MONTH)
-- ============================================
CREATE OR REPLACE FUNCTION refresh_monthly_promoter_aggregates()
RETURNS void AS $$
BEGIN
  PERFORM refresh_monthly_promoter_aggregates_for_month((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE);
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- FUNCTION: Refresh Daily Store Aggregates
-- ============================================
CREATE OR REPLACE FUNCTION refresh_daily_store_aggregates()
RETURNS void AS $$
BEGIN
  DELETE FROM agg_daily_store WHERE agg_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE;

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
    (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE as agg_date,
    COUNT(*) as total_input,
    COUNT(*) FILTER (WHERE approval_status = 'approved') as total_approved,
    COUNT(*) FILTER (WHERE approval_status = 'rejected') as total_rejected,
    COUNT(*) FILTER (WHERE transaction_status = 'closed') as total_closed,
    COUNT(*) FILTER (WHERE approval_status = 'approved' AND transaction_status = 'not_closed') as total_pending,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id NOT IN (SELECT transaction_id FROM conversions)) as total_closing_direct,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id IN (SELECT transaction_id FROM conversions)) as total_closing_followup
  FROM vast_finance_data_new
  WHERE DATE(sale_date) = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE
    AND deleted_at IS NULL
  GROUP BY store_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Refresh Monthly Store Aggregates
-- ============================================
CREATE OR REPLACE FUNCTION refresh_monthly_store_aggregates()
RETURNS void AS $$
BEGIN
  DELETE FROM agg_monthly_store WHERE agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE);

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
    DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE) as agg_month,
    COUNT(*) as total_input,
    COUNT(*) FILTER (WHERE approval_status = 'approved') as total_approved,
    COUNT(*) FILTER (WHERE approval_status = 'rejected') as total_rejected,
    COUNT(*) FILTER (WHERE transaction_status = 'closed') as total_closed,
    COUNT(*) FILTER (WHERE approval_status = 'approved' AND transaction_status = 'not_closed') as total_pending,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id NOT IN (SELECT transaction_id FROM conversions)) as total_closing_direct,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id IN (SELECT transaction_id FROM conversions)) as total_closing_followup
  FROM vast_finance_data_new
  WHERE DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
    AND deleted_at IS NULL
  GROUP BY store_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER FUNCTION: Auto-refresh on data change
-- UPDATED: Refresh based on ACTUAL sale_date, not just today
-- ============================================
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
    
    -- Refresh aggregates for the AFFECTED date, not just today
    PERFORM refresh_daily_promoter_aggregates_for_date(affected_date);
    PERFORM refresh_monthly_promoter_aggregates_for_month(affected_month);
    
    -- Also refresh store aggregates
    PERFORM refresh_daily_store_aggregates();
    PERFORM refresh_monthly_store_aggregates();
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS: Attach to tables
-- ============================================

-- Trigger on vast_finance_data_new (row-level for accurate date tracking)
DROP TRIGGER IF EXISTS trigger_agg_on_submission ON vast_finance_data_new;
CREATE TRIGGER trigger_agg_on_submission
  AFTER INSERT OR UPDATE OR DELETE ON vast_finance_data_new
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_aggregates();

-- Trigger on conversions
DROP TRIGGER IF EXISTS trigger_agg_on_conversion ON conversions;
CREATE TRIGGER trigger_agg_on_conversion
  AFTER INSERT OR UPDATE OR DELETE ON conversions
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_aggregates();

-- ============================================
-- INITIAL RUN: Populate existing data
-- ============================================
SELECT refresh_daily_promoter_aggregates();
SELECT refresh_monthly_promoter_aggregates();
SELECT refresh_daily_store_aggregates();
SELECT refresh_monthly_store_aggregates();

