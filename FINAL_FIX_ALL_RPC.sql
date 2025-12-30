-- ============================================
-- FINAL FIX: ALL RPC FUNCTIONS
-- Run this to fix ALL errors
-- ============================================

-- DROP ALL OLD FUNCTIONS
DROP FUNCTION IF EXISTS get_team_monthly_data(UUID, TEXT);
DROP FUNCTION IF EXISTS get_team_daily_data(UUID, TEXT);
DROP FUNCTION IF EXISTS get_team_daily_with_sators(UUID, TEXT);

-- ============================================================================
-- FIXED: get_team_monthly_data
-- FIX: Use different return column names to avoid ambiguity
-- ============================================================================
CREATE OR REPLACE FUNCTION get_team_monthly_data(
    p_manager_id UUID,
    p_month TEXT
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
    v_month_num INTEGER;
BEGIN
    v_month_date := p_month::DATE;
    v_year := EXTRACT(YEAR FROM v_month_date)::INTEGER;
    v_month_num := EXTRACT(MONTH FROM v_month_date)::INTEGER;

    RETURN QUERY
    WITH subordinates AS (
        SELECT h.user_id FROM hierarchy h WHERE h.atasan_id = p_manager_id
    ),
    user_info AS (
        SELECT u.id, u.name, u.employee_id, u.role
        FROM users u
        INNER JOIN subordinates s ON u.id = s.user_id
    ),
    aggregates AS (
        SELECT sator_user_id as uid, v.total_input, v.total_rejected, v.total_pending, v.total_closed, v.total_approved
        FROM v_agg_monthly_sator_all v
        WHERE sator_user_id IN (SELECT sub.user_id FROM subordinates sub) AND v.agg_month = v_month_date
        UNION ALL
        SELECT promoter_user_id as uid, v.total_input, v.total_rejected, v.total_pending, v.total_closed, v.total_approved
        FROM v_agg_monthly_promoter_all v
        WHERE promoter_user_id IN (SELECT sub.user_id FROM subordinates sub) AND v.agg_month = v_month_date
        UNION ALL
        SELECT spv_user_id as uid, v.total_input, v.total_rejected, v.total_pending, v.total_closed, v.total_approved
        FROM v_agg_monthly_spv_all v
        WHERE spv_user_id IN (SELECT sub.user_id FROM subordinates sub) AND v.agg_month = v_month_date
    ),
    agg_summary AS (
        SELECT a.uid, SUM(a.total_input)::BIGINT as ti, SUM(a.total_rejected)::BIGINT as tr, 
               SUM(a.total_pending)::BIGINT as tp, SUM(a.total_closed)::BIGINT as tc, SUM(a.total_approved)::BIGINT as ta
        FROM aggregates a GROUP BY a.uid
    ),
    targets_data AS (
        SELECT t.user_id as tid, t.target_value
        FROM targets t
        WHERE t.user_id IN (SELECT sub.user_id FROM subordinates sub)
          AND t.period_year = v_year AND t.period_month = v_month_num
    ),
    manager_target_data AS (
        SELECT target_value FROM targets
        WHERE user_id = p_manager_id AND period_year = v_year AND period_month = v_month_num AND target_type = 'primary'
        LIMIT 1
    )
    SELECT 
        ui.id,
        ui.name,
        ui.employee_id,
        ui.role,
        COALESCE(agg.ti, 0)::BIGINT,
        COALESCE(agg.tr, 0)::BIGINT,
        COALESCE(agg.tp, 0)::BIGINT,
        COALESCE(agg.tc, 0)::BIGINT,
        COALESCE(agg.ta, 0)::BIGINT,
        p_month,
        COALESCE(td.target_value, 0)::INTEGER,
        COALESCE((SELECT target_value FROM manager_target_data), 0)::INTEGER
    FROM user_info ui
    LEFT JOIN agg_summary agg ON agg.uid = ui.id
    LEFT JOIN targets_data td ON td.tid = ui.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_team_monthly_data(UUID, TEXT) TO authenticated, service_role;


-- ============================================================================
-- FIXED: get_team_daily_data
-- ============================================================================
CREATE OR REPLACE FUNCTION get_team_daily_data(
    p_manager_id UUID,
    p_date TEXT
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
        SELECT h.user_id FROM hierarchy h WHERE h.atasan_id = p_manager_id
    ),
    user_info AS (
        SELECT u.id, u.name, u.employee_id, u.role
        FROM users u INNER JOIN subordinates s ON u.id = s.user_id
    ),
    aggregates AS (
        SELECT sator_user_id as uid, v.total_input, v.total_rejected, v.total_pending, v.total_closed, v.total_approved
        FROM v_agg_daily_sator_all v
        WHERE sator_user_id IN (SELECT sub.user_id FROM subordinates sub) AND v.agg_date = v_date
        UNION ALL
        SELECT promoter_user_id as uid, v.total_input, v.total_rejected, v.total_pending, v.total_closed, v.total_approved
        FROM v_agg_daily_promoter_all v
        WHERE promoter_user_id IN (SELECT sub.user_id FROM subordinates sub) AND v.agg_date = v_date
        UNION ALL
        SELECT spv_user_id as uid, v.total_input, v.total_rejected, v.total_pending, v.total_closed, v.total_approved
        FROM v_agg_daily_spv_all v
        WHERE spv_user_id IN (SELECT sub.user_id FROM subordinates sub) AND v.agg_date = v_date
    ),
    agg_summary AS (
        SELECT a.uid, SUM(a.total_input)::BIGINT as ti, SUM(a.total_rejected)::BIGINT as tr,
               SUM(a.total_pending)::BIGINT as tp, SUM(a.total_closed)::BIGINT as tc, SUM(a.total_approved)::BIGINT as ta
        FROM aggregates a GROUP BY a.uid
    )
    SELECT ui.id, ui.name, ui.employee_id, ui.role,
           COALESCE(agg.ti, 0)::BIGINT, COALESCE(agg.tr, 0)::BIGINT, COALESCE(agg.tp, 0)::BIGINT,
           COALESCE(agg.tc, 0)::BIGINT, COALESCE(agg.ta, 0)::BIGINT, p_date
    FROM user_info ui
    LEFT JOIN agg_summary agg ON ui.id = agg.uid
    ORDER BY ui.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_team_daily_data(UUID, TEXT) TO authenticated, service_role;


-- ============================================================================
-- FIXED: get_team_daily_with_sators (JSON return - no ambiguity issue)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_team_daily_with_sators(
    p_manager_id UUID,
    p_date TEXT
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_date DATE;
BEGIN
    v_date := p_date::DATE;
    
    WITH subordinates AS (
        SELECT h.user_id FROM hierarchy h WHERE h.atasan_id = p_manager_id
    ),
    sators AS (
        SELECT u.id as user_id, u.name
        FROM users u INNER JOIN subordinates s ON u.id = s.user_id
        WHERE u.role = 'sator'
    ),
    sator_subordinates AS (
        SELECT h.atasan_id as sator_id, h.user_id as promotor_id
        FROM hierarchy h WHERE h.atasan_id IN (SELECT user_id FROM sators)
    ),
    all_promotor_ids AS (
        SELECT promotor_id as user_id, sator_id FROM sator_subordinates
        UNION ALL
        SELECT sub.user_id, NULL::UUID as sator_id
        FROM subordinates sub INNER JOIN users u ON u.id = sub.user_id WHERE u.role = 'promotor'
    ),
    promotor_data AS (
        SELECT p.user_id as promoter_user_id, u.name as promoter_name, p.sator_id,
               COALESCE(agg.total_input, 0) as total_input, COALESCE(agg.total_closed, 0) as total_closed,
               COALESCE(agg.total_pending, 0) as total_pending, COALESCE(agg.total_rejected, 0) as total_rejected
        FROM all_promotor_ids p
        INNER JOIN users u ON u.id = p.user_id
        LEFT JOIN v_agg_daily_promoter_all agg ON agg.promoter_user_id = p.user_id AND agg.agg_date = v_date
    ),
    sators_with_promotors AS (
        SELECT s.user_id, s.name,
               (SELECT json_agg(pd.promoter_user_id ORDER BY pd.total_input DESC)
                FROM promotor_data pd WHERE pd.sator_id = s.user_id) as promotor_ids
        FROM sators s
    )
    SELECT json_build_object(
        'promotors', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'promoter_user_id', pd.promoter_user_id, 'promoter_name', pd.promoter_name,
                    'total_input', pd.total_input, 'total_closed', pd.total_closed,
                    'total_pending', pd.total_pending, 'total_rejected', pd.total_rejected, 'sator_id', pd.sator_id
                ) ORDER BY pd.total_input DESC
            ), '[]'::json) FROM promotor_data pd
        ),
        'sators', (
            SELECT COALESCE(json_agg(
                json_build_object('user_id', swp.user_id, 'name', swp.name, 'promotor_ids', COALESCE(swp.promotor_ids, '[]'::json))
            ), '[]'::json) FROM sators_with_promotors swp
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_team_daily_with_sators(UUID, TEXT) TO authenticated, service_role;

-- ============================================
-- TEST (Run after above)
-- ============================================
-- SELECT * FROM get_team_monthly_data('fc769700-99f5-4177-9f18-a4bb906fedfc', '2025-12-01');
