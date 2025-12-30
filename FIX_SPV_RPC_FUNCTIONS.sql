-- ============================================
-- FIX ALL SPV/SATOR/PROMOTOR RPC FUNCTIONS 
-- Run this after FIX_RPC_FUNCTIONS.sql
-- This fixes ALL remaining RPC functions
-- ============================================

-- DROP old broken functions first
DROP FUNCTION IF EXISTS get_team_monthly_data(UUID, TEXT);
DROP FUNCTION IF EXISTS get_team_daily_data(UUID, TEXT);
DROP FUNCTION IF EXISTS get_team_daily_with_sators(UUID, TEXT);

-- ============================================================================
-- FIXED FUNCTION: get_team_monthly_data
-- FIX: Cast date comparisons properly
-- ============================================================================
CREATE OR REPLACE FUNCTION get_team_monthly_data(
    p_manager_id UUID,
    p_month TEXT  -- Format: 'YYYY-MM-01'
)
RETURNS TABLE(
    user_id UUID,
    name TEXT,
    employee_id TEXT,
    role TEXT,
    total_input BIGINT,
    total_rejected BIGINT,
    total_pending BIGINT,
    total_closed BIGINT,
    total_approved BIGINT,
    agg_month TEXT,
    target INTEGER,
    manager_target INTEGER
) AS $$
DECLARE
    v_month_date DATE;
    v_year INTEGER;
    v_month INTEGER;
    v_month_key TEXT;
BEGIN
    -- Parse date
    v_month_date := p_month::DATE;
    v_month_key := SUBSTRING(p_month, 1, 7); -- 'YYYY-MM'
    v_year := EXTRACT(YEAR FROM v_month_date)::INTEGER;
    v_month := EXTRACT(MONTH FROM v_month_date)::INTEGER;

    -- Single query to get all team data with hierarchy
    RETURN QUERY
    WITH subordinates AS (
        -- Get direct subordinates
        SELECT h.user_id
        FROM hierarchy h
        WHERE h.atasan_id = p_manager_id
    ),
    user_info AS (
        -- Get user details
        SELECT 
            u.id,
            u.name,
            u.employee_id,
            u.role
        FROM users u
        INNER JOIN subordinates s ON u.id = s.user_id
    ),
    aggregates AS (
        -- Union all aggregate views in one go - FIX: Use DATE comparison
        SELECT 
            sator_user_id as uid,
            CAST(total_input AS BIGINT) as total_input,
            CAST(total_rejected AS BIGINT) as total_rejected,
            CAST(total_pending AS BIGINT) as total_pending,
            CAST(total_closed AS BIGINT) as total_closed,
            CAST(total_approved AS BIGINT) as total_approved
        FROM v_agg_monthly_sator_all
        WHERE sator_user_id IN (SELECT sub.user_id FROM subordinates sub)
          AND agg_month = v_month_date
        
        UNION ALL
        
        SELECT 
            promoter_user_id as uid,
            CAST(total_input AS BIGINT) as total_input,
            CAST(total_rejected AS BIGINT) as total_rejected,
            CAST(total_pending AS BIGINT) as total_pending,
            CAST(total_closed AS BIGINT) as total_closed,
            CAST(total_approved AS BIGINT) as total_approved
        FROM v_agg_monthly_promoter_all
        WHERE promoter_user_id IN (SELECT sub.user_id FROM subordinates sub)
          AND agg_month = v_month_date
        
        UNION ALL
        
        SELECT 
            spv_user_id as uid,
            CAST(total_input AS BIGINT) as total_input,
            CAST(total_rejected AS BIGINT) as total_rejected,
            CAST(total_pending AS BIGINT) as total_pending,
            CAST(total_closed AS BIGINT) as total_closed,
            CAST(total_approved AS BIGINT) as total_approved
        FROM v_agg_monthly_spv_all
        WHERE spv_user_id IN (SELECT sub.user_id FROM subordinates sub)
          AND agg_month = v_month_date
    ),
    agg_summary AS (
        -- Aggregate per user (in case multiple records)
        SELECT 
            a.uid,
            SUM(a.total_input) as total_input,
            SUM(a.total_rejected) as total_rejected,
            SUM(a.total_pending) as total_pending,
            SUM(a.total_closed) as total_closed,
            SUM(a.total_approved) as total_approved
        FROM aggregates a
        GROUP BY a.uid
    ),
    targets_data AS (
        -- Get targets for subordinates
        SELECT 
            t.user_id as tid,
            t.target_value
        FROM targets t
        WHERE t.user_id IN (SELECT sub.user_id FROM subordinates sub)
          AND t.period_year = v_year
          AND t.period_month = v_month
    ),
    manager_target_data AS (
        -- Get manager's own target
        SELECT target_value
        FROM targets
        WHERE targets.user_id = p_manager_id
          AND period_year = v_year
          AND period_month = v_month
          AND target_type = 'primary'
        LIMIT 1
    )
    -- Final join
    SELECT 
        ui.id as user_id,
        ui.name,
        ui.employee_id,
        ui.role,
        COALESCE(agg.total_input, 0)::BIGINT as total_input,
        COALESCE(agg.total_rejected, 0)::BIGINT as total_rejected,
        COALESCE(agg.total_pending, 0)::BIGINT as total_pending,
        COALESCE(agg.total_closed, 0)::BIGINT as total_closed,
        COALESCE(agg.total_approved, 0)::BIGINT as total_approved,
        p_month as agg_month,
        COALESCE(td.target_value, 0)::INTEGER as target,
        COALESCE((SELECT target_value FROM manager_target_data), 0)::INTEGER as manager_target
    FROM user_info ui
    LEFT JOIN agg_summary agg ON agg.uid = ui.id
    LEFT JOIN targets_data td ON td.tid = ui.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_team_monthly_data(UUID, TEXT) TO authenticated, service_role;


-- ============================================================================
-- FIXED FUNCTION: get_team_daily_with_sators
-- FIX: Cast date comparisons properly  
-- ============================================================================
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
        -- Direct promotors under manager
        SELECT sub.user_id, NULL::UUID as sator_id
        FROM subordinates sub
        INNER JOIN users u ON u.id = sub.user_id
        WHERE u.role = 'promotor'
    ),
    promotor_data AS (
        SELECT 
            p.user_id as promoter_user_id,
            u.name as promoter_name,
            p.sator_id,
            COALESCE(agg.total_input, 0) as total_input,
            COALESCE(agg.total_closed, 0) as total_closed,
            COALESCE(agg.total_pending, 0) as total_pending,
            COALESCE(agg.total_rejected, 0) as total_rejected
        FROM all_promotor_ids p
        INNER JOIN users u ON u.id = p.user_id
        LEFT JOIN v_agg_daily_promoter_all agg ON agg.promoter_user_id = p.user_id AND agg.agg_date = v_date
    ),
    sators_with_promotors AS (
        SELECT 
            s.user_id,
            s.name,
            (
                SELECT json_agg(pd.promoter_user_id ORDER BY pd.total_input DESC)
                FROM promotor_data pd
                WHERE pd.sator_id = s.user_id
            ) as promotor_ids
        FROM sators s
    )
    SELECT json_build_object(
        'promotors', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'promoter_user_id', pd.promoter_user_id,
                    'promoter_name', pd.promoter_name,
                    'total_input', pd.total_input,
                    'total_closed', pd.total_closed,
                    'total_pending', pd.total_pending,
                    'total_rejected', pd.total_rejected,
                    'sator_id', pd.sator_id
                ) ORDER BY pd.total_input DESC
            ), '[]'::json)
            FROM promotor_data pd
        ),
        'sators', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'user_id', swp.user_id,
                    'name', swp.name,
                    'promotor_ids', COALESCE(swp.promotor_ids, '[]'::json)
                )
            ), '[]'::json)
            FROM sators_with_promotors swp
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_team_daily_with_sators(UUID, TEXT) TO authenticated, service_role;


-- ============================================================================
-- FIXED FUNCTION: get_team_daily_data (Simple version)
-- FIX: Ensure proper DATE casting
-- ============================================================================
CREATE OR REPLACE FUNCTION get_team_daily_data(
    p_manager_id UUID,
    p_date TEXT  -- Format: 'YYYY-MM-DD'
)
RETURNS TABLE(
    user_id UUID,
    name TEXT,
    employee_id TEXT,
    role TEXT,
    total_input BIGINT,
    total_rejected BIGINT,
    total_pending BIGINT,
    total_closed BIGINT,
    total_approved BIGINT,
    agg_date TEXT
) AS $$
DECLARE
    v_date DATE;
BEGIN
    v_date := p_date::DATE;
    
    RETURN QUERY
    WITH subordinates AS (
        SELECT h.user_id
        FROM hierarchy h
        WHERE h.atasan_id = p_manager_id
    ),
    user_info AS (
        SELECT 
            u.id,
            u.name,
            u.employee_id,
            u.role
        FROM users u
        INNER JOIN subordinates s ON u.id = s.user_id
    ),
    aggregates AS (
        SELECT 
            sator_user_id as uid,
            CAST(v.total_input AS BIGINT) as total_input,
            CAST(v.total_rejected AS BIGINT) as total_rejected,
            CAST(v.total_pending AS BIGINT) as total_pending,
            CAST(v.total_closed AS BIGINT) as total_closed,
            CAST(v.total_approved AS BIGINT) as total_approved
        FROM v_agg_daily_sator_all v
        WHERE sator_user_id IN (SELECT sub.user_id FROM subordinates sub)
          AND v.agg_date = v_date
        
        UNION ALL
        
        SELECT 
            promoter_user_id as uid,
            CAST(v.total_input AS BIGINT) as total_input,
            CAST(v.total_rejected AS BIGINT) as total_rejected,
            CAST(v.total_pending AS BIGINT) as total_pending,
            CAST(v.total_closed AS BIGINT) as total_closed,
            CAST(v.total_approved AS BIGINT) as total_approved
        FROM v_agg_daily_promoter_all v
        WHERE promoter_user_id IN (SELECT sub.user_id FROM subordinates sub)
          AND v.agg_date = v_date
        
        UNION ALL
        
        SELECT 
            spv_user_id as uid,
            CAST(v.total_input AS BIGINT) as total_input,
            CAST(v.total_rejected AS BIGINT) as total_rejected,
            CAST(v.total_pending AS BIGINT) as total_pending,
            CAST(v.total_closed AS BIGINT) as total_closed,
            CAST(v.total_approved AS BIGINT) as total_approved
        FROM v_agg_daily_spv_all v
        WHERE spv_user_id IN (SELECT sub.user_id FROM subordinates sub)
          AND v.agg_date = v_date
    ),
    agg_summary AS (
        SELECT 
            a.uid,
            SUM(a.total_input) as total_input,
            SUM(a.total_rejected) as total_rejected,
            SUM(a.total_pending) as total_pending,
            SUM(a.total_closed) as total_closed,
            SUM(a.total_approved) as total_approved
        FROM aggregates a
        GROUP BY a.uid
    )
    SELECT 
        ui.id as user_id,
        ui.name,
        ui.employee_id,
        ui.role,
        COALESCE(agg.total_input, 0)::BIGINT as total_input,
        COALESCE(agg.total_rejected, 0)::BIGINT as total_rejected,
        COALESCE(agg.total_pending, 0)::BIGINT as total_pending,
        COALESCE(agg.total_closed, 0)::BIGINT as total_closed,
        COALESCE(agg.total_approved, 0)::BIGINT as total_approved,
        p_date as agg_date
    FROM user_info ui
    LEFT JOIN agg_summary agg ON ui.id = agg.uid
    ORDER BY ui.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_team_daily_data(UUID, TEXT) TO authenticated, service_role;

-- ============================================
-- ALL RPC FUNCTIONS FIXED!
-- ============================================
-- TEST QUERIES (Run after above to verify)
-- ============================================
-- Test SPV monthly:
-- SELECT * FROM get_team_monthly_data('fc769700-99f5-4177-9f18-a4bb906fedfc', '2025-01-01');

-- Test SPV daily:
-- SELECT * FROM get_team_daily_with_sators('fc769700-99f5-4177-9f18-a4bb906fedfc', '2025-12-30');

-- Test team daily simple:
-- SELECT * FROM get_team_daily_data('fc769700-99f5-4177-9f18-a4bb906fedfc', '2025-12-30');
