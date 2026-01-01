-- ============================================
-- FIX v2: Column Ambiguity Issue
-- Error: column reference "total_input" is ambiguous
-- Solution: Use out_ prefix for return columns
-- ============================================

-- DROP old functions first
DROP FUNCTION IF EXISTS get_team_monthly_data(UUID, TEXT);
DROP FUNCTION IF EXISTS get_team_daily_with_sators(UUID, TEXT);
DROP FUNCTION IF EXISTS get_team_daily_data(UUID, TEXT);

-- ============================================================================
-- FIXED FUNCTION: get_team_monthly_data
-- FIX: Use out_ prefix for return columns to avoid ambiguity
-- ============================================================================
CREATE OR REPLACE FUNCTION get_team_monthly_data(
    p_manager_id UUID,
    p_month TEXT  -- Format: 'YYYY-MM-01'
)
RETURNS TABLE(
    out_user_id UUID,
    out_name TEXT,
    out_employee_id TEXT,
    out_role TEXT,
    out_total_input BIGINT,
    out_total_rejected BIGINT,
    out_total_pending BIGINT,
    out_total_closed BIGINT,
    out_total_approved BIGINT,
    out_agg_month TEXT,
    out_target INTEGER,
    out_manager_target INTEGER
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
        -- Get direct subordinates (only active users via hierarchy join)
        SELECT h.user_id
        FROM hierarchy h
        INNER JOIN users u ON u.id = h.user_id
        WHERE h.atasan_id = p_manager_id
          AND u.status = 'active'
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
        WHERE u.status = 'active'
    ),
    aggregates AS (
        SELECT 
            sator_user_id as uid,
            CAST(v.total_input AS BIGINT) as agg_total_input,
            CAST(v.total_rejected AS BIGINT) as agg_total_rejected,
            CAST(v.total_pending AS BIGINT) as agg_total_pending,
            CAST(v.total_closed AS BIGINT) as agg_total_closed,
            CAST(v.total_approved AS BIGINT) as agg_total_approved
        FROM v_agg_monthly_sator_all v
        WHERE sator_user_id IN (SELECT sub.user_id FROM subordinates sub)
          AND v.agg_month = v_month_date
        
        UNION ALL
        
        SELECT 
            promoter_user_id as uid,
            CAST(v.total_input AS BIGINT) as agg_total_input,
            CAST(v.total_rejected AS BIGINT) as agg_total_rejected,
            CAST(v.total_pending AS BIGINT) as agg_total_pending,
            CAST(v.total_closed AS BIGINT) as agg_total_closed,
            CAST(v.total_approved AS BIGINT) as agg_total_approved
        FROM v_agg_monthly_promoter_all v
        WHERE promoter_user_id IN (SELECT sub.user_id FROM subordinates sub)
          AND v.agg_month = v_month_date
        
        UNION ALL
        
        SELECT 
            spv_user_id as uid,
            CAST(v.total_input AS BIGINT) as agg_total_input,
            CAST(v.total_rejected AS BIGINT) as agg_total_rejected,
            CAST(v.total_pending AS BIGINT) as agg_total_pending,
            CAST(v.total_closed AS BIGINT) as agg_total_closed,
            CAST(v.total_approved AS BIGINT) as agg_total_approved
        FROM v_agg_monthly_spv_all v
        WHERE spv_user_id IN (SELECT sub.user_id FROM subordinates sub)
          AND v.agg_month = v_month_date
    ),
    agg_summary AS (
        SELECT 
            a.uid,
            SUM(a.agg_total_input) as sum_total_input,
            SUM(a.agg_total_rejected) as sum_total_rejected,
            SUM(a.agg_total_pending) as sum_total_pending,
            SUM(a.agg_total_closed) as sum_total_closed,
            SUM(a.agg_total_approved) as sum_total_approved
        FROM aggregates a
        GROUP BY a.uid
    ),
    targets_data AS (
        SELECT 
            t.user_id as tid,
            t.target_value
        FROM targets t
        WHERE t.user_id IN (SELECT sub.user_id FROM subordinates sub)
          AND t.period_year = v_year
          AND t.period_month = v_month
    ),
    manager_target_data AS (
        SELECT target_value
        FROM targets
        WHERE targets.user_id = p_manager_id
          AND period_year = v_year
          AND period_month = v_month
          AND target_type = 'primary'
        LIMIT 1
    )
    SELECT 
        ui.id as out_user_id,
        ui.name as out_name,
        ui.employee_id as out_employee_id,
        ui.role as out_role,
        COALESCE(agg.sum_total_input, 0)::BIGINT as out_total_input,
        COALESCE(agg.sum_total_rejected, 0)::BIGINT as out_total_rejected,
        COALESCE(agg.sum_total_pending, 0)::BIGINT as out_total_pending,
        COALESCE(agg.sum_total_closed, 0)::BIGINT as out_total_closed,
        COALESCE(agg.sum_total_approved, 0)::BIGINT as out_total_approved,
        p_month as out_agg_month,
        COALESCE(td.target_value, 0)::INTEGER as out_target,
        COALESCE((SELECT target_value FROM manager_target_data), 0)::INTEGER as out_manager_target
    FROM user_info ui
    LEFT JOIN agg_summary agg ON agg.uid = ui.id
    LEFT JOIN targets_data td ON td.tid = ui.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_team_monthly_data(UUID, TEXT) TO authenticated, service_role;


-- ============================================================================
-- FIXED FUNCTION: get_team_daily_with_sators
-- FIX: Added status = 'active' filter
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
        INNER JOIN users u ON u.id = h.user_id
        WHERE h.atasan_id = p_manager_id
          AND u.status = 'active'
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
        INNER JOIN users u ON u.id = h.user_id
        WHERE h.atasan_id IN (SELECT user_id FROM sators)
          AND u.status = 'active'
    ),
    all_promotor_ids AS (
        SELECT promotor_id as user_id, sator_id FROM sator_subordinates
        UNION ALL
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
            COALESCE(agg.total_input, 0) as p_total_input,
            COALESCE(agg.total_closed, 0) as p_total_closed,
            COALESCE(agg.total_pending, 0) as p_total_pending,
            COALESCE(agg.total_rejected, 0) as p_total_rejected
        FROM all_promotor_ids p
        INNER JOIN users u ON u.id = p.user_id
        LEFT JOIN v_agg_daily_promoter_all agg ON agg.promoter_user_id = p.user_id AND agg.agg_date = v_date
        WHERE u.status = 'active'
    ),
    sators_with_promotors AS (
        SELECT 
            s.user_id,
            s.name,
            (
                SELECT json_agg(pd.promoter_user_id ORDER BY pd.p_total_input DESC)
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
                    'total_input', pd.p_total_input,
                    'total_closed', pd.p_total_closed,
                    'total_pending', pd.p_total_pending,
                    'total_rejected', pd.p_total_rejected,
                    'sator_id', pd.sator_id
                ) ORDER BY pd.p_total_input DESC
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
-- FIXED FUNCTION: get_team_daily_data
-- FIX: Use out_ prefix and agg_ prefix to avoid ambiguity
-- ============================================================================
CREATE OR REPLACE FUNCTION get_team_daily_data(
    p_manager_id UUID,
    p_date TEXT  -- Format: 'YYYY-MM-DD'
)
RETURNS TABLE(
    out_user_id UUID,
    out_name TEXT,
    out_employee_id TEXT,
    out_role TEXT,
    out_total_input BIGINT,
    out_total_rejected BIGINT,
    out_total_pending BIGINT,
    out_total_closed BIGINT,
    out_total_approved BIGINT,
    out_agg_date TEXT
) AS $$
DECLARE
    v_date DATE;
BEGIN
    v_date := p_date::DATE;
    
    RETURN QUERY
    WITH subordinates AS (
        SELECT h.user_id
        FROM hierarchy h
        INNER JOIN users u ON u.id = h.user_id
        WHERE h.atasan_id = p_manager_id
          AND u.status = 'active'
    ),
    user_info AS (
        SELECT 
            u.id,
            u.name,
            u.employee_id,
            u.role
        FROM users u
        INNER JOIN subordinates s ON u.id = s.user_id
        WHERE u.status = 'active'
    ),
    aggregates AS (
        SELECT 
            sator_user_id as uid,
            CAST(v.total_input AS BIGINT) as agg_total_input,
            CAST(v.total_rejected AS BIGINT) as agg_total_rejected,
            CAST(v.total_pending AS BIGINT) as agg_total_pending,
            CAST(v.total_closed AS BIGINT) as agg_total_closed,
            CAST(v.total_approved AS BIGINT) as agg_total_approved
        FROM v_agg_daily_sator_all v
        WHERE sator_user_id IN (SELECT sub.user_id FROM subordinates sub)
          AND v.agg_date = v_date
        
        UNION ALL
        
        SELECT 
            promoter_user_id as uid,
            CAST(v.total_input AS BIGINT) as agg_total_input,
            CAST(v.total_rejected AS BIGINT) as agg_total_rejected,
            CAST(v.total_pending AS BIGINT) as agg_total_pending,
            CAST(v.total_closed AS BIGINT) as agg_total_closed,
            CAST(v.total_approved AS BIGINT) as agg_total_approved
        FROM v_agg_daily_promoter_all v
        WHERE promoter_user_id IN (SELECT sub.user_id FROM subordinates sub)
          AND v.agg_date = v_date
        
        UNION ALL
        
        SELECT 
            spv_user_id as uid,
            CAST(v.total_input AS BIGINT) as agg_total_input,
            CAST(v.total_rejected AS BIGINT) as agg_total_rejected,
            CAST(v.total_pending AS BIGINT) as agg_total_pending,
            CAST(v.total_closed AS BIGINT) as agg_total_closed,
            CAST(v.total_approved AS BIGINT) as agg_total_approved
        FROM v_agg_daily_spv_all v
        WHERE spv_user_id IN (SELECT sub.user_id FROM subordinates sub)
          AND v.agg_date = v_date
    ),
    agg_summary AS (
        SELECT 
            a.uid,
            SUM(a.agg_total_input) as sum_total_input,
            SUM(a.agg_total_rejected) as sum_total_rejected,
            SUM(a.agg_total_pending) as sum_total_pending,
            SUM(a.agg_total_closed) as sum_total_closed,
            SUM(a.agg_total_approved) as sum_total_approved
        FROM aggregates a
        GROUP BY a.uid
    )
    SELECT 
        ui.id as out_user_id,
        ui.name as out_name,
        ui.employee_id as out_employee_id,
        ui.role as out_role,
        COALESCE(agg.sum_total_input, 0)::BIGINT as out_total_input,
        COALESCE(agg.sum_total_rejected, 0)::BIGINT as out_total_rejected,
        COALESCE(agg.sum_total_pending, 0)::BIGINT as out_total_pending,
        COALESCE(agg.sum_total_closed, 0)::BIGINT as out_total_closed,
        COALESCE(agg.sum_total_approved, 0)::BIGINT as out_total_approved,
        p_date as out_agg_date
    FROM user_info ui
    LEFT JOIN agg_summary agg ON ui.id = agg.uid
    ORDER BY ui.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_team_daily_data(UUID, TEXT) TO authenticated, service_role;


-- ============================================
-- TEST: Verify functions work
-- ============================================
-- SELECT * FROM get_team_monthly_data('fc769700-99f5-4177-9f18-a4bb906fedfc'::UUID, '2026-01-01');
