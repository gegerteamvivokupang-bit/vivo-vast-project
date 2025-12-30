-- ============================================
-- FIX SQL RPC FUNCTIONS 
-- Run this in Supabase SQL Editor to fix the errors
-- ============================================

-- DROP old broken functions first
DROP FUNCTION IF EXISTS get_manager_monthly_hierarchy(TEXT);
DROP FUNCTION IF EXISTS get_manager_daily_hierarchy(TEXT);

-- ============================================================================
-- FIXED FUNCTION: get_manager_monthly_hierarchy
-- FIX: Cast p_month to DATE for comparison with agg_month (DATE type)
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
        WHERE role = 'spv' AND status = 'active'
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
        WHERE u.status = 'active'
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
-- FIX: Remove json || json concatenation, use simpler approach
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
        WHERE role = 'spv' AND status = 'active'
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
        WHERE u.status = 'active'
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
-- TEST QUERIES (Run after above to verify)
-- ============================================
-- SELECT * FROM get_manager_monthly_hierarchy('2025-01-01');
-- SELECT * FROM get_manager_daily_hierarchy('2025-12-30');
