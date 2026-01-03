-- ============================================================================
-- COMPLETE FIX: ALL DATA ISSUES - VAST FINANCE
-- Date: 2026-01-03
-- Purpose: Fix ALL recurring issues permanently
-- 
-- INSTRUKSI: Jalankan SELURUH script ini di Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: FIX RPC FUNCTION - get_team_daily_with_sators
-- Problem: Sators hanya return promotor_ids, bukan data agregasi lengkap
-- ============================================================================

DROP FUNCTION IF EXISTS get_team_daily_with_sators(UUID, TEXT);

CREATE OR REPLACE FUNCTION get_team_daily_with_sators(
    p_manager_id UUID,
    p_date TEXT  -- Format: 'YYYY-MM-DD'
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_date DATE;
BEGIN
    v_date := p_date::DATE;
    
    WITH subordinates AS (
        SELECT h.user_id
        FROM hierarchy h
        WHERE h.atasan_id = p_manager_id
    ),
    sators AS (
        SELECT 
            u.id as user_id,
            u.name
        FROM users u
        INNER JOIN subordinates s ON u.id = s.user_id
        WHERE u.role = 'sator'
          AND u.status = 'active'
    ),
    sator_subordinates AS (
        SELECT 
            h.atasan_id as sator_id,
            h.user_id as promotor_id
        FROM hierarchy h
        WHERE h.atasan_id IN (SELECT user_id FROM sators)
    ),
    all_promotor_ids AS (
        -- Promotors under SATORs
        SELECT promotor_id as user_id, sator_id FROM sator_subordinates
        UNION ALL
        -- Direct promotors under manager (SPV with dual role)
        SELECT sub.user_id, NULL::UUID as sator_id
        FROM subordinates sub
        INNER JOIN users u ON u.id = sub.user_id
        WHERE u.role = 'promotor'
          AND u.status = 'active'
    ),
    promotor_data AS (
        SELECT 
            p.user_id as promoter_user_id,
            u.name as promoter_name,
            p.sator_id,
            COALESCE(agg.total_input, 0)::INTEGER as total_input,
            COALESCE(agg.total_closed, 0)::INTEGER as total_closed,
            COALESCE(agg.total_pending, 0)::INTEGER as total_pending,
            COALESCE(agg.total_rejected, 0)::INTEGER as total_rejected
        FROM all_promotor_ids p
        INNER JOIN users u ON u.id = p.user_id
        LEFT JOIN v_agg_daily_promoter_all agg 
            ON agg.promoter_user_id = p.user_id 
            AND agg.agg_date = v_date
        WHERE u.status = 'active'
    ),
    -- Calculate sator totals by summing their promotors
    sators_with_data AS (
        SELECT 
            s.user_id,
            s.name,
            COALESCE(SUM(pd.total_input), 0)::INTEGER as total_input,
            COALESCE(SUM(pd.total_closed), 0)::INTEGER as total_closed,
            COALESCE(SUM(pd.total_pending), 0)::INTEGER as total_pending,
            COALESCE(SUM(pd.total_rejected), 0)::INTEGER as total_rejected
        FROM sators s
        LEFT JOIN promotor_data pd ON pd.sator_id = s.user_id
        GROUP BY s.user_id, s.name
    ),
    -- Build promotors array for each sator
    sators_complete AS (
        SELECT 
            swd.user_id,
            swd.name,
            swd.total_input,
            swd.total_closed,
            swd.total_pending,
            swd.total_rejected,
            COALESCE(
                (
                    SELECT json_agg(
                        json_build_object(
                            'user_id', pd.promoter_user_id::TEXT,
                            'name', pd.promoter_name,
                            'total_input', pd.total_input,
                            'total_closed', pd.total_closed,
                            'total_pending', pd.total_pending,
                            'total_rejected', pd.total_rejected
                        ) ORDER BY pd.total_input DESC
                    )
                    FROM promotor_data pd
                    WHERE pd.sator_id = swd.user_id
                ),
                '[]'::json
            ) as promotors
        FROM sators_with_data swd
    ),
    -- Direct promotors (those directly under manager, not under any sator)
    direct_promotors AS (
        SELECT 
            pd.promoter_user_id as user_id,
            pd.promoter_name as name,
            pd.total_input,
            pd.total_closed,
            pd.total_pending,
            pd.total_rejected
        FROM promotor_data pd
        WHERE pd.sator_id IS NULL
    )
    SELECT json_build_object(
        'promotors', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'promoter_user_id', promoter_user_id,
                    'promoter_name', promoter_name,
                    'total_input', total_input,
                    'total_closed', total_closed,
                    'total_pending', total_pending,
                    'total_rejected', total_rejected,
                    'sator_id', sator_id
                ) ORDER BY total_input DESC
            ), '[]'::json)
            FROM promotor_data
        ),
        'sators', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'user_id', sc.user_id,
                    'name', sc.name,
                    'total_input', sc.total_input,
                    'total_closed', sc.total_closed,
                    'total_pending', sc.total_pending,
                    'total_rejected', sc.total_rejected,
                    'promotors', sc.promotors
                ) ORDER BY sc.total_input DESC
            ), '[]'::json)
            FROM sators_complete sc
        ),
        'direct_promotors', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'user_id', dp.user_id,
                    'name', dp.name,
                    'total_input', dp.total_input,
                    'total_closed', dp.total_closed,
                    'total_pending', dp.total_pending,
                    'total_rejected', dp.total_rejected
                ) ORDER BY dp.total_input DESC
            ), '[]'::json)
            FROM direct_promotors dp
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_team_daily_with_sators(UUID, TEXT) TO authenticated, service_role;

-- ============================================================================
-- PART 2: FIX AGGREGATION FUNCTIONS - Support any date, not just today
-- Problem: Trigger only refreshes TODAY's data
-- ============================================================================

-- New function: Refresh aggregates for ANY specific date
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
    COUNT(*) FILTER (WHERE approval_status = 'approved' AND transaction_status = 'not_closed' OR UPPER(status) = 'PENDING') as total_pending,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id NOT IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)) as total_closing_direct,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)) as total_closing_followup
  FROM vast_finance_data_new
  WHERE DATE(sale_date) = target_date
    AND deleted_at IS NULL
  GROUP BY created_by_user_id;
END;
$$ LANGUAGE plpgsql;

-- Update original function to use the new date-specific function
CREATE OR REPLACE FUNCTION refresh_daily_promoter_aggregates()
RETURNS void AS $$
BEGIN
  -- Refresh for today in WITA timezone
  PERFORM refresh_daily_promoter_aggregates_for_date((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE);
END;
$$ LANGUAGE plpgsql;

-- New function: Refresh aggregates for specific month
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
    COUNT(*) FILTER (WHERE approval_status = 'approved' AND transaction_status = 'not_closed' OR UPPER(status) = 'PENDING') as total_pending,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id NOT IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)) as total_closing_direct,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' AND id IN (SELECT transaction_id FROM conversions WHERE transaction_id IS NOT NULL)) as total_closing_followup
  FROM vast_finance_data_new
  WHERE DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', target_month)
    AND deleted_at IS NULL
  GROUP BY created_by_user_id;
END;
$$ LANGUAGE plpgsql;

-- Update original monthly function
CREATE OR REPLACE FUNCTION refresh_monthly_promoter_aggregates()
RETURNS void AS $$
BEGIN
  PERFORM refresh_monthly_promoter_aggregates_for_month((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 3: SMART TRIGGER - Refresh based on the ACTUAL sale_date, not just today
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
    
    -- Refresh aggregates for the AFFECTED date, not just today
    PERFORM refresh_daily_promoter_aggregates_for_date(affected_date);
    PERFORM refresh_monthly_promoter_aggregates_for_month(affected_month);
    
    -- Also refresh store aggregates if store_id exists
    IF TG_OP != 'DELETE' AND NEW.store_id IS NOT NULL THEN
        -- Simplified: just call the existing store functions
        PERFORM refresh_daily_store_aggregates();
        PERFORM refresh_monthly_store_aggregates();
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Re-create trigger
DROP TRIGGER IF EXISTS trigger_agg_on_submission ON vast_finance_data_new;
CREATE TRIGGER trigger_agg_on_submission
  AFTER INSERT OR UPDATE OR DELETE ON vast_finance_data_new
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_aggregates();

-- ============================================================================
-- PART 4: REFRESH DATA UNTUK KEMARIN DAN HARI INI
-- ============================================================================

-- Refresh yesterday's data
SELECT refresh_daily_promoter_aggregates_for_date(
    ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar') - INTERVAL '1 day')::DATE
);

-- Refresh today's data
SELECT refresh_daily_promoter_aggregates_for_date(
    (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE
);

-- Refresh this month's data
SELECT refresh_monthly_promoter_aggregates_for_month(
    (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE
);

-- ============================================================================
-- PART 5: VERIFICATION QUERY
-- Run this after the script to verify data exists
-- ============================================================================

-- Check data for yesterday
SELECT 
    'Yesterday' as period,
    ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar') - INTERVAL '1 day')::DATE as date,
    COUNT(*) as promotor_count,
    COALESCE(SUM(total_input), 0) as total_input
FROM agg_daily_promoter
WHERE agg_date = ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar') - INTERVAL '1 day')::DATE

UNION ALL

-- Check data for today
SELECT 
    'Today' as period,
    (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE as date,
    COUNT(*) as promotor_count,
    COALESCE(SUM(total_input), 0) as total_input
FROM agg_daily_promoter
WHERE agg_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE;

-- ============================================================================
-- DONE! Your data should now be correct.
-- ============================================================================
