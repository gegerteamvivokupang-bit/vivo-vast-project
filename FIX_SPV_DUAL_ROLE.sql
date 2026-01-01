-- ============================================
-- FIX: Dual Role SPV not showing in SATOR list
-- Issue: ANFAL (SUMBA) and WILIBRODUS (KABUPATEN) are SPVs with direct promotors 
--        but they don't appear in the SATOR list
-- Solution: Add SPV dual role to sators list when they have direct promotors
-- ============================================

DROP FUNCTION IF EXISTS get_manager_daily_hierarchy(TEXT);

-- ============================================================================
-- FIXED FUNCTION: get_manager_daily_hierarchy  
-- FIX: Include SPV dual role (SPV with direct promotors) in sators list
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
    -- Get promotors under each SATOR (regular sators)
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
    -- ✅ NEW: SPV as SATOR (SPV dual role - has direct promotors)
    spv_as_sator AS (
        SELECT 
            spv.id as sator_id,
            spv.name as sator_name,
            spv.id as spv_id,  -- SPV is their own "parent" for grouping
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
    -- ✅ COMBINED: All sators (regular + SPV dual role)
    all_sators AS (
        SELECT sator_id, sator_name, spv_id, promotors, total_input, total_closed, total_pending, total_rejected
        FROM sator_promotors
        
        UNION ALL
        
        SELECT sator_id, sator_name, spv_id, promotors, total_input, total_closed, total_pending, total_rejected
        FROM spv_as_sator
    ),
    -- Build areas with all sators (including SPV dual role)
    areas_full AS (
        SELECT 
            spv.id as user_id,
            COALESCE(h_spv.area, spv.name) as area_name,
            spv.name as spv_name,
            (
                SELECT COALESCE(json_agg(
                    json_build_object(
                        'user_id', alls.sator_id,
                        'name', alls.sator_name,
                        'total_input', alls.total_input,
                        'total_closed', alls.total_closed,
                        'total_pending', alls.total_pending,
                        'total_rejected', alls.total_rejected,
                        'promotors', alls.promotors
                    ) ORDER BY alls.total_input DESC
                ), '[]'::json)
                FROM all_sators alls
                WHERE alls.spv_id = spv.id
            ) as sators,
            COALESCE((SELECT SUM(alls.total_input) FROM all_sators alls WHERE alls.spv_id = spv.id), 0) as total_input,
            COALESCE((SELECT SUM(alls.total_closed) FROM all_sators alls WHERE alls.spv_id = spv.id), 0) as total_closed,
            COALESCE((SELECT SUM(alls.total_pending) FROM all_sators alls WHERE alls.spv_id = spv.id), 0) as total_pending,
            COALESCE((SELECT SUM(alls.total_rejected) FROM all_sators alls WHERE alls.spv_id = spv.id), 0) as total_rejected
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
-- TEST: Verify ANFAL and WILIBRODUS appear
-- ============================================
-- SELECT * FROM get_manager_daily_hierarchy('2026-01-01');
