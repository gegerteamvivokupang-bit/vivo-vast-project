-- ============================================
-- FIX: Filter Inactive Users from Dashboard
-- Run this in Supabase SQL Editor
-- Issue: Promotor yang dinonaktifkan masih muncul di dashboard
-- Fix: Tambahkan filter status = 'active' pada semua RPC functions
-- ============================================

-- DROP old functions first
DROP FUNCTION IF EXISTS get_team_monthly_data(UUID, TEXT);
DROP FUNCTION IF EXISTS get_team_daily_with_sators(UUID, TEXT);
DROP FUNCTION IF EXISTS get_team_daily_data(UUID, TEXT);

-- ============================================================================
-- FIXED FUNCTION: get_team_monthly_data
-- FIX: Added status = 'active' filter to exclude inactive users
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
        -- Get direct subordinates (only active users via hierarchy join)
        SELECT h.user_id
        FROM hierarchy h
        INNER JOIN users u ON u.id = h.user_id
        WHERE h.atasan_id = p_manager_id
          AND u.status = 'active'  -- ✅ FIX: Only include active users
    ),
    user_info AS (
        -- Get user details (already filtered by status in subordinates)
        SELECT 
            u.id,
            u.name,
            u.employee_id,
            u.role
        FROM users u
        INNER JOIN subordinates s ON u.id = s.user_id
        WHERE u.status = 'active'  -- ✅ FIX: Double-check active status
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
-- FIX: Added status = 'active' filter to exclude inactive users
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
          AND u.status = 'active'  -- ✅ FIX: Only include active users
    ),
    sators AS (
        SELECT 
            u.id as user_id,
            u.name
        FROM users u
        INNER JOIN subordinates s ON u.id = s.user_id
        WHERE u.role = 'sator'
          AND u.status = 'active'  -- ✅ FIX: Only active sators
    ),
    sator_subordinates AS (
        SELECT 
            h.atasan_id as sator_id,
            h.user_id as promotor_id
        FROM hierarchy h
        INNER JOIN users u ON u.id = h.user_id
        WHERE h.atasan_id IN (SELECT user_id FROM sators)
          AND u.status = 'active'  -- ✅ FIX: Only active promotors under sators
    ),
    all_promotor_ids AS (
        -- Promotors under SATORs (already filtered)
        SELECT promotor_id as user_id, sator_id FROM sator_subordinates
        UNION ALL
        -- Direct promotors under manager (need to filter)
        SELECT sub.user_id, NULL::UUID as sator_id
        FROM subordinates sub
        INNER JOIN users u ON u.id = sub.user_id
        WHERE u.role = 'promotor'
          AND u.status = 'active'  -- ✅ FIX: Only active direct promotors
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
        WHERE u.status = 'active'  -- ✅ FIX: Final check for active status
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
-- FIX: Added status = 'active' filter to exclude inactive users
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
        INNER JOIN users u ON u.id = h.user_id
        WHERE h.atasan_id = p_manager_id
          AND u.status = 'active'  -- ✅ FIX: Only include active users
    ),
    user_info AS (
        SELECT 
            u.id,
            u.name,
            u.employee_id,
            u.role
        FROM users u
        INNER JOIN subordinates s ON u.id = s.user_id
        WHERE u.status = 'active'  -- ✅ FIX: Double-check active status
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
-- ALSO FIX: Manager Dashboard Functions
-- Just to make sure they all have active filter
-- ============================================

DROP FUNCTION IF EXISTS get_manager_monthly_hierarchy(TEXT);
DROP FUNCTION IF EXISTS get_manager_daily_hierarchy(TEXT);

-- ============================================================================
-- FIXED FUNCTION: get_manager_monthly_hierarchy
-- FIX: Ensure all status = 'active' filters are in place
-- ============================================================================
CREATE OR REPLACE FUNCTION get_manager_monthly_hierarchy(
    p_month TEXT  -- Format: 'YYYY-MM-01'
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_month_date DATE;
    v_year INT;
    v_month INT;
BEGIN
    -- Parse month 
    v_month_date := p_month::DATE;
    v_year := EXTRACT(YEAR FROM v_month_date)::INT;
    v_month := EXTRACT(MONTH FROM v_month_date)::INT;
    
    WITH spv_list AS (
        SELECT id, name, employee_id
        FROM users
        WHERE role = 'spv' AND status = 'active'  -- ✅ Active SPVs only
    ),
    hierarchy_full AS (
        SELECT 
            h.user_id,
            h.atasan_id,
            h.area,
            u.name,
            u.role
        FROM hierarchy h
        INNER JOIN users u ON u.id = h.user_id
        WHERE u.status = 'active'  -- ✅ Active users only
    ),
    -- Get all aggregate data - FIX: Cast to DATE
    spv_agg AS (
        SELECT * FROM v_agg_monthly_spv_all
        WHERE agg_month = v_month_date
    ),
    sator_agg AS (
        SELECT * FROM v_agg_monthly_sator_all
        WHERE agg_month = v_month_date
    ),
    promotor_agg AS (
        SELECT * FROM v_agg_monthly_promoter_all
        WHERE agg_month = v_month_date
    ),
    targets_all AS (
        SELECT user_id, target_value, target_type
        FROM targets
        WHERE period_year = v_year AND period_month = v_month
    ),
    -- Build Areas (SPV level)
    areas_data AS (
        SELECT 
            spv.id as user_id,
            COALESCE(h_spv.area, spv.name) as name,
            spv.name as spv_name,
            'area' as role,
            COALESCE(spv_a.total_input, 0) + COALESCE(sator_a.total_input, 0) as total_input,
            COALESCE(spv_a.total_pending, 0) + COALESCE(sator_a.total_pending, 0) as total_pending,
            COALESCE(spv_a.total_rejected, 0) + COALESCE(sator_a.total_rejected, 0) as total_rejected,
            COALESCE(spv_a.total_closed, 0) + COALESCE(sator_a.total_closed, 0) as total_closed,
            COALESCE(t.target_value, 0) as target,
            COALESCE(spv_a.sator_count, 0) as sator_count,
            COALESCE(sator_a.promotor_count, 0) as promotor_direct_count
        FROM spv_list spv
        LEFT JOIN hierarchy_full h_spv ON h_spv.user_id = spv.id
        LEFT JOIN spv_agg spv_a ON spv_a.spv_user_id = spv.id
        LEFT JOIN sator_agg sator_a ON sator_a.sator_user_id = spv.id
        LEFT JOIN targets_all t ON t.user_id = spv.id AND (t.target_type = 'primary' OR t.target_type IS NULL)
    ),
    -- Build Sators
    sators_regular AS (
        SELECT 
            h.user_id,
            h.name,
            'sator' as role,
            COALESCE(h_spv.area, spv.name) as area,
            spv.name as spv_name,
            COALESCE(agg.total_input, 0) as total_input,
            COALESCE(agg.total_pending, 0) as total_pending,
            COALESCE(agg.total_rejected, 0) as total_rejected,
            COALESCE(agg.total_closed, 0) as total_closed,
            COALESCE(t.target_value, 0) as target,
            COALESCE(agg.promotor_count, 0) as promotor_count
        FROM hierarchy_full h
        INNER JOIN spv_list spv ON spv.id = h.atasan_id
        LEFT JOIN hierarchy_full h_spv ON h_spv.user_id = spv.id
        LEFT JOIN sator_agg agg ON agg.sator_user_id = h.user_id
        LEFT JOIN targets_all t ON t.user_id = h.user_id AND (t.target_type = 'primary' OR t.target_type IS NULL)
        WHERE h.role = 'sator'
    ),
    spv_dual_role AS (
        SELECT 
            spv.id as user_id,
            spv.name,
            'spv' as role,
            COALESCE(h.area, spv.name) as area,
            spv.name as spv_name,
            COALESCE(agg.total_input, 0) as total_input,
            COALESCE(agg.total_pending, 0) as total_pending,
            COALESCE(agg.total_rejected, 0) as total_rejected,
            COALESCE(agg.total_closed, 0) as total_closed,
            COALESCE(t_as_sator.target_value, t_primary.target_value, 0) as target,
            COALESCE(agg.promotor_count, 0) as promotor_count
        FROM spv_list spv
        LEFT JOIN hierarchy_full h ON h.user_id = spv.id
        LEFT JOIN sator_agg agg ON agg.sator_user_id = spv.id
        LEFT JOIN targets_all t_as_sator ON t_as_sator.user_id = spv.id AND t_as_sator.target_type = 'as_sator'
        LEFT JOIN targets_all t_primary ON t_primary.user_id = spv.id AND (t_primary.target_type = 'primary' OR t_primary.target_type IS NULL)
        WHERE EXISTS (
            SELECT 1 FROM hierarchy_full hf 
            WHERE hf.atasan_id = spv.id AND hf.role = 'promotor'
        )
    ),
    sators_combined AS (
        SELECT * FROM sators_regular
        UNION ALL
        SELECT * FROM spv_dual_role
    ),
    -- Build Promotors
    promotors_data AS (
        SELECT 
            h.user_id,
            h.name,
            'promotor' as role,
            CASE 
                WHEN h_atasan.role = 'sator' THEN COALESCE(h_spv.area, spv.name)
                WHEN h_atasan.role = 'spv' THEN COALESCE(h_atasan.area, h_atasan.name)
                ELSE 'Unknown'
            END as area,
            CASE 
                WHEN h_atasan.role = 'sator' THEN spv.name
                WHEN h_atasan.role = 'spv' THEN h_atasan.name
                ELSE 'Unknown'
            END as spv_name,
            CASE 
                WHEN h_atasan.role = 'sator' THEN h_atasan.name
                WHEN h_atasan.role = 'spv' THEN h_atasan.name
                ELSE 'Unknown'
            END as sator_name,
            COALESCE(agg.total_input, 0) as total_input,
            COALESCE(agg.total_pending, 0) as total_pending,
            COALESCE(agg.total_rejected, 0) as total_rejected,
            COALESCE(agg.total_closed, 0) as total_closed,
            COALESCE(t.target_value, 0) as target
        FROM hierarchy_full h
        LEFT JOIN hierarchy_full h_atasan ON h_atasan.user_id = h.atasan_id
        LEFT JOIN hierarchy_full h_sator ON h_sator.user_id = h.atasan_id AND h_atasan.role = 'sator'
        LEFT JOIN hierarchy_full h_spv ON h_spv.user_id = h_sator.atasan_id
        LEFT JOIN spv_list spv ON spv.id = h_sator.atasan_id OR (h_atasan.role = 'spv' AND spv.id = h.atasan_id)
        LEFT JOIN promotor_agg agg ON agg.promoter_user_id = h.user_id
        LEFT JOIN targets_all t ON t.user_id = h.user_id AND (t.target_type = 'primary' OR t.target_type IS NULL)
        WHERE h.role = 'promotor'
    )
    SELECT json_build_object(
        'areas', (SELECT COALESCE(json_agg(row_to_json(areas_data)), '[]'::json) FROM areas_data),
        'sators', (SELECT COALESCE(json_agg(row_to_json(sators_combined)), '[]'::json) FROM sators_combined),
        'promotors', (SELECT COALESCE(json_agg(row_to_json(promotors_data)), '[]'::json) FROM promotors_data)
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_manager_monthly_hierarchy(TEXT) TO authenticated, service_role;


-- ============================================================================
-- FIXED FUNCTION: get_manager_daily_hierarchy  
-- FIX: Ensure all status = 'active' filters are in place
-- ============================================================================
CREATE OR REPLACE FUNCTION get_manager_daily_hierarchy(
    p_date TEXT  -- Format: 'YYYY-MM-DD'
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_date DATE;
BEGIN
    v_date := p_date::DATE;
    
    WITH spv_list AS (
        SELECT id, name, employee_id
        FROM users
        WHERE role = 'spv' AND status = 'active'  -- ✅ Active SPVs only
    ),
    hierarchy_full AS (
        SELECT 
            h.user_id,
            h.atasan_id,
            h.area,
            u.name,
            u.role,
            u.employee_id
        FROM hierarchy h
        INNER JOIN users u ON u.id = h.user_id
        WHERE u.status = 'active'  -- ✅ Active users only
    ),
    promotor_daily AS (
        SELECT 
            promoter_user_id,
            total_input,
            total_closed,
            total_pending,
            total_rejected
        FROM v_agg_daily_promoter_all
        WHERE agg_date = v_date
    ),
    -- Get promotors under each SATOR
    sator_promotors AS (
        SELECT 
            h_sator.user_id as sator_id,
            h_sator.name as sator_name,
            h_sator.atasan_id as spv_id,
            json_agg(
                json_build_object(
                    'user_id', h_prom.user_id,
                    'name', h_prom.name,
                    'total_input', COALESCE(pd.total_input, 0),
                    'total_closed', COALESCE(pd.total_closed, 0),
                    'total_pending', COALESCE(pd.total_pending, 0),
                    'total_rejected', COALESCE(pd.total_rejected, 0),
                    'is_empty', COALESCE(pd.total_input, 0) = 0,
                    'has_reject', COALESCE(pd.total_rejected, 0) > 0
                ) ORDER BY COALESCE(pd.total_input, 0) DESC
            ) as promotors,
            COALESCE(SUM(pd.total_input), 0) as total_input,
            COALESCE(SUM(pd.total_closed), 0) as total_closed,
            COALESCE(SUM(pd.total_pending), 0) as total_pending,
            COALESCE(SUM(pd.total_rejected), 0) as total_rejected
        FROM hierarchy_full h_sator
        INNER JOIN hierarchy_full h_prom ON h_prom.atasan_id = h_sator.user_id AND h_prom.role = 'promotor'
        LEFT JOIN promotor_daily pd ON pd.promoter_user_id = h_prom.user_id
        WHERE h_sator.role = 'sator'
        GROUP BY h_sator.user_id, h_sator.name, h_sator.atasan_id
    ),
    -- Get direct promotors under SPV
    spv_direct_promotors AS (
        SELECT 
            spv.id as spv_id,
            spv.name as spv_name,
            json_agg(
                json_build_object(
                    'user_id', h_prom.user_id,
                    'name', h_prom.name,
                    'total_input', COALESCE(pd.total_input, 0),
                    'total_closed', COALESCE(pd.total_closed, 0),
                    'total_pending', COALESCE(pd.total_pending, 0),
                    'total_rejected', COALESCE(pd.total_rejected, 0),
                    'is_empty', COALESCE(pd.total_input, 0) = 0,
                    'has_reject', COALESCE(pd.total_rejected, 0) > 0
                ) ORDER BY COALESCE(pd.total_input, 0) DESC
            ) as promotors,
            COALESCE(SUM(pd.total_input), 0) as total_input,
            COALESCE(SUM(pd.total_closed), 0) as total_closed,
            COALESCE(SUM(pd.total_pending), 0) as total_pending,
            COALESCE(SUM(pd.total_rejected), 0) as total_rejected
        FROM spv_list spv
        INNER JOIN hierarchy_full h_prom ON h_prom.atasan_id = spv.id AND h_prom.role = 'promotor'
        LEFT JOIN promotor_daily pd ON pd.promoter_user_id = h_prom.user_id
        GROUP BY spv.id, spv.name
    ),
    -- Build areas with sators
    areas_full AS (
        SELECT 
            spv.id as user_id,
            COALESCE(h_spv.area, spv.name) as area_name,
            spv.name as spv_name,
            (
                SELECT COALESCE(json_agg(
                    json_build_object(
                        'user_id', sp.sator_id,
                        'name', sp.sator_name,
                        'total_input', sp.total_input,
                        'total_closed', sp.total_closed,
                        'total_pending', sp.total_pending,
                        'total_rejected', sp.total_rejected,
                        'promotors', sp.promotors
                    ) ORDER BY sp.total_input DESC
                ), '[]'::json)
                FROM sator_promotors sp
                WHERE sp.spv_id = spv.id
            ) as sators,
            (
                SELECT sdp.promotors
                FROM spv_direct_promotors sdp
                WHERE sdp.spv_id = spv.id
            ) as direct_promotors,
            COALESCE((SELECT SUM(sp.total_input) FROM sator_promotors sp WHERE sp.spv_id = spv.id), 0) +
            COALESCE((SELECT sdp.total_input FROM spv_direct_promotors sdp WHERE sdp.spv_id = spv.id), 0) as total_input,
            COALESCE((SELECT SUM(sp.total_closed) FROM sator_promotors sp WHERE sp.spv_id = spv.id), 0) +
            COALESCE((SELECT sdp.total_closed FROM spv_direct_promotors sdp WHERE sdp.spv_id = spv.id), 0) as total_closed,
            COALESCE((SELECT SUM(sp.total_pending) FROM sator_promotors sp WHERE sp.spv_id = spv.id), 0) +
            COALESCE((SELECT sdp.total_pending FROM spv_direct_promotors sdp WHERE sdp.spv_id = spv.id), 0) as total_pending,
            COALESCE((SELECT SUM(sp.total_rejected) FROM sator_promotors sp WHERE sp.spv_id = spv.id), 0) +
            COALESCE((SELECT sdp.total_rejected FROM spv_direct_promotors sdp WHERE sdp.spv_id = spv.id), 0) as total_rejected
        FROM spv_list spv
        LEFT JOIN hierarchy_full h_spv ON h_spv.user_id = spv.id
    ),
    stats AS (
        SELECT 
            COUNT(DISTINCT CASE WHEN pd.total_input > 0 THEN hf.user_id END) as active_count,
            COUNT(DISTINCT CASE WHEN COALESCE(pd.total_input, 0) = 0 THEN hf.user_id END) as empty_count,
            COUNT(DISTINCT CASE WHEN pd.total_rejected > 0 THEN hf.user_id END) as reject_count,
            COUNT(DISTINCT hf.user_id) as total_count
        FROM hierarchy_full hf
        LEFT JOIN promotor_daily pd ON pd.promoter_user_id = hf.user_id
        WHERE hf.role = 'promotor'
    )
    SELECT json_build_object(
        'date', p_date,
        'date_formatted', TO_CHAR(v_date, 'Day, DD Month YYYY'),
        'totals', json_build_object(
            'total_input', (SELECT COALESCE(SUM(total_input), 0) FROM areas_full),
            'total_closed', (SELECT COALESCE(SUM(total_closed), 0) FROM areas_full),
            'total_pending', (SELECT COALESCE(SUM(total_pending), 0) FROM areas_full),
            'total_rejected', (SELECT COALESCE(SUM(total_rejected), 0) FROM areas_full)
        ),
        'promotor_stats', (SELECT row_to_json(stats) FROM stats),
        'areas', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'user_id', af.user_id,
                    'area_name', af.area_name,
                    'spv_name', af.spv_name,
                    'total_input', af.total_input,
                    'total_closed', af.total_closed,
                    'total_pending', af.total_pending,
                    'total_rejected', af.total_rejected,
                    'sators', af.sators
                ) ORDER BY af.total_input DESC
            ), '[]'::json)
            FROM areas_full af
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_manager_daily_hierarchy(TEXT) TO authenticated, service_role;


-- ============================================
-- VERIFICATION QUERIES
-- Run these after deploying to verify fix works
-- ============================================

-- Check inactive users exist
-- SELECT id, name, role, status FROM users WHERE status = 'inactive';

-- Test that inactive users are no longer returned
-- SELECT * FROM get_team_monthly_data('your-spv-uuid-here', '2025-01-01');
-- SELECT * FROM get_team_daily_with_sators('your-spv-uuid-here', '2025-01-01');
-- SELECT * FROM get_manager_monthly_hierarchy('2025-01-01');
-- SELECT * FROM get_manager_daily_hierarchy('2025-01-01');

-- ============================================
-- ALL FUNCTIONS NOW FILTER INACTIVE USERS!
-- ============================================
