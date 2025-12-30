-- ============================================================================
-- TURBO QUERY RPC FUNCTIONS
-- Optimized single-query functions to replace N+1 patterns
-- Created: 2025-12-30
-- ============================================================================

-- ============================================================================
-- FUNCTION: get_team_monthly_data
-- Purpose: Get all subordinate monthly data in ONE query
-- Replaces: Multiple queries to v_agg_monthly_sator_all, v_agg_monthly_promoter_all, v_agg_monthly_spv_all
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
    v_start_date TEXT;
    v_end_date TEXT;
    v_year INTEGER;
    v_month INTEGER;
    v_month_key TEXT;
BEGIN
    -- Calculate date range
    v_start_date := p_month;
    v_month_key := SUBSTRING(p_month, 1, 7); -- 'YYYY-MM'
    
    -- Calculate next month for range
    v_year := CAST(SUBSTRING(p_month, 1, 4) AS INTEGER);
    v_month := CAST(SUBSTRING(p_month, 6, 2) AS INTEGER);
    v_month := v_month + 1;
    IF v_month > 12 THEN
        v_month := 1;
        v_year := v_year + 1;
    END IF;
    v_end_date := v_year || '-' || LPAD(v_month::TEXT, 2, '0') || '-01';

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
        -- Union all aggregate views in one go
        SELECT 
            sator_user_id as uid,
            total_input,
            total_rejected,
            total_pending,
            total_closed,
            total_approved
        FROM v_agg_monthly_sator_all
        WHERE sator_user_id IN (SELECT user_id FROM subordinates)
          AND agg_month >= v_start_date
          AND agg_month < v_end_date
        
        UNION ALL
        
        SELECT 
            promoter_user_id as uid,
            total_input,
            total_rejected,
            total_pending,
            total_closed,
            total_approved
        FROM v_agg_monthly_promoter_all
        WHERE promoter_user_id IN (SELECT user_id FROM subordinates)
          AND agg_month >= v_start_date
          AND agg_month < v_end_date
        
        UNION ALL
        
        SELECT 
            spv_user_id as uid,
            total_input,
            total_rejected,
            total_pending,
            total_closed,
            total_approved
        FROM v_agg_monthly_spv_all
        WHERE spv_user_id IN (SELECT user_id FROM subordinates)
          AND agg_month >= v_start_date
          AND agg_month < v_end_date
    ),
    agg_summary AS (
        -- Aggregate per user (in case multiple records)
        SELECT 
            uid,
            SUM(total_input) as total_input,
            SUM(total_rejected) as total_rejected,
            SUM(total_pending) as total_pending,
            SUM(total_closed) as total_closed,
            SUM(total_approved) as total_approved
        FROM aggregates
        GROUP BY uid
    ),
    targets_data AS (
        -- Get targets for subordinates
        SELECT 
            t.user_id,
            t.target_value
        FROM targets t
        WHERE t.user_id IN (SELECT user_id FROM subordinates)
          AND t.month = v_month_key
    ),
    manager_target_data AS (
        -- Get manager's own target
        SELECT target_value
        FROM targets
        WHERE user_id = p_manager_id
          AND month = v_month_key
          AND target_type = 'primary'
        LIMIT 1
    )
    -- Final join
    SELECT 
        ui.id as user_id,
        ui.name,
        ui.employee_id,
        ui.role,
        COALESCE(agg.total_input, 0) as total_input,
        COALESCE(agg.total_rejected, 0) as total_rejected,
        COALESCE(agg.total_pending, 0) as total_pending,
        COALESCE(agg.total_closed, 0) as total_closed,
        COALESCE(agg.total_approved, 0) as total_approved,
        p_month as agg_month,
        COALESCE(td.target_value, 0) as target,
        COALESCE((SELECT target_value FROM manager_target_data), 0) as manager_target
    FROM user_info ui
    LEFT JOIN agg_summary agg ON ui.id = agg.uid
    LEFT JOIN targets_data td ON ui.id = td.user_id
    ORDER BY ui.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_team_monthly_data(UUID, TEXT) TO authenticated, service_role;

-- ============================================================================
-- FUNCTION: get_team_daily_data
-- Purpose: Get all subordinate daily data in ONE query
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
BEGIN
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
            total_input,
            total_rejected,
            total_pending,
            total_closed,
            total_approved
        FROM v_agg_daily_sator_all
        WHERE sator_user_id IN (SELECT user_id FROM subordinates)
          AND agg_date = p_date::DATE
        
        UNION ALL
        
        SELECT 
            promoter_user_id as uid,
            total_input,
            total_rejected,
            total_pending,
            total_closed,
            total_approved
        FROM v_agg_daily_promoter_all
        WHERE promoter_user_id IN (SELECT user_id FROM subordinates)
          AND agg_date = p_date::DATE
        
        UNION ALL
        
        SELECT 
            spv_user_id as uid,
            total_input,
            total_rejected,
            total_pending,
            total_closed,
            total_approved
        FROM v_agg_daily_spv_all
        WHERE spv_user_id IN (SELECT user_id FROM subordinates)
          AND agg_date = p_date::DATE
    ),
    agg_summary AS (
        SELECT 
            uid,
            SUM(total_input) as total_input,
            SUM(total_rejected) as total_rejected,
            SUM(total_pending) as total_pending,
            SUM(total_closed) as total_closed,
            SUM(total_approved) as total_approved
        FROM aggregates
        GROUP BY uid
    )
    SELECT 
        ui.id as user_id,
        ui.name,
        ui.employee_id,
        ui.role,
        COALESCE(agg.total_input, 0) as total_input,
        COALESCE(agg.total_rejected, 0) as total_rejected,
        COALESCE(agg.total_pending, 0) as total_pending,
        COALESCE(agg.total_closed, 0) as total_closed,
        COALESCE(agg.total_approved, 0) as total_approved,
        p_date as agg_date
    FROM user_info ui
    LEFT JOIN agg_summary agg ON ui.id = agg.uid
    ORDER BY ui.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_team_daily_data(UUID, TEXT) TO authenticated, service_role;

-- ============================================================================
-- FUNCTION: get_team_daily_with_sators
-- Purpose: Get daily team data WITH sator grouping for SPV dashboard
-- ============================================================================
CREATE OR REPLACE FUNCTION get_team_daily_with_sators(
    p_manager_id UUID,
    p_date TEXT  -- Format: 'YYYY-MM-DD'
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    WITH subordinates AS (
        SELECT h.user_id, u.role, u.name, u.employee_id
        FROM hierarchy h
        INNER JOIN users u ON u.id = h.user_id
        WHERE h.atasan_id = p_manager_id
    ),
    sator_list AS (
        SELECT user_id, name, employee_id
        FROM subordinates
        WHERE role = 'sator'
    ),
    direct_promotors AS (
        SELECT user_id, name, employee_id
        FROM subordinates
        WHERE role = 'promotor'
    ),
    sator_promotors AS (
        -- Get promotors under each SATOR
        SELECT 
            sh.atasan_id as sator_id,
            sh.user_id as promotor_id,
            u.name as promotor_name,
            u.employee_id as promotor_employee_id
        FROM hierarchy sh
        INNER JOIN users u ON u.id = sh.user_id
        WHERE sh.atasan_id IN (SELECT user_id FROM sator_list)
          AND u.role = 'promotor'
    ),
    all_promotors AS (
        -- Combine direct promotors + promotors under sators
        SELECT 
            promotor_id as user_id,
            promotor_name as name,
            promotor_employee_id as employee_id,
            sator_id
        FROM sator_promotors
        
        UNION ALL
        
        SELECT 
            user_id,
            name,
            employee_id,
            NULL as sator_id
        FROM direct_promotors
    ),
    promotor_data AS (
        SELECT 
            ap.user_id,
            ap.name,
            ap.employee_id,
            ap.sator_id,
            COALESCE(v.total_input, 0) as total_input,
            COALESCE(v.total_rejected, 0) as total_rejected,
            COALESCE(v.total_pending, 0) as total_pending,
            COALESCE(v.total_closed, 0) as total_closed,
            COALESCE(v.total_approved, 0) as total_approved,
            COALESCE(v.total_closing_direct, 0) as total_closing_direct,
            COALESCE(v.total_closing_followup, 0) as total_closing_followup
        FROM all_promotors ap
        LEFT JOIN v_agg_daily_promoter_all v 
            ON v.promoter_user_id = ap.user_id
            AND v.agg_date = p_date::DATE
    ),
    sators_with_promotors AS (
        SELECT 
            sl.user_id,
            sl.name,
            json_agg(
                json_build_object(
                    'promoter_user_id', pd.user_id,
                    'promoter_name', pd.name,
                    'employee_id', pd.employee_id,
                    'total_input', pd.total_input,
                    'total_rejected', pd.total_rejected,
                    'total_pending', pd.total_pending,
                    'total_closed', pd.total_closed,
                    'total_approved', pd.total_approved,
                    'total_closing_direct', pd.total_closing_direct,
                    'total_closing_followup', pd.total_closing_followup,
                    'agg_date', p_date
                ) ORDER BY pd.name
            ) FILTER (WHERE pd.user_id IS NOT NULL) as promotors
        FROM sator_list sl
        LEFT JOIN promotor_data pd ON pd.sator_id = sl.user_id
        GROUP BY sl.user_id, sl.name
    )
    SELECT json_build_object(
        'promotors', (SELECT json_agg(
            json_build_object(
                'promoter_user_id', user_id,
                'promoter_name', name,
                'employee_id', employee_id,
                'total_input', total_input,
                'total_rejected', total_rejected,
                'total_pending', total_pending,
                'total_closed', total_closed,
                'total_approved', total_approved,
                'total_closing_direct', total_closing_direct,
                'total_closing_followup', total_closing_followup,
                'agg_date', p_date,
                'sator_id', sator_id
            ) ORDER BY name
        ) FROM promotor_data),
        'sators', (SELECT json_agg(
            json_build_object(
                'user_id', user_id,
                'name', name,
                'promotor_ids', (
                    SELECT json_agg(pd.user_id)
                    FROM promotor_data pd
                    WHERE pd.sator_id = swp.user_id
                )
            ) ORDER BY name
        ) FROM sators_with_promotors swp)
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_team_daily_with_sators(UUID, TEXT) TO authenticated, service_role;

-- ============================================================================
-- FUNCTION: get_manager_daily_hierarchy
-- Purpose: Get complete Area → Sator → Promotor hierarchy for Manager dashboard
-- This eliminates MASSIVE nested loops in the Edge Function
-- ============================================================================
CREATE OR REPLACE FUNCTION get_manager_daily_hierarchy(
    p_date TEXT  -- Format: 'YYYY-MM-DD'
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_total_promotors INT;
    v_active_promotors INT;
    v_empty_promotors INT;
    v_reject_promotors INT;
    v_grand_totals RECORD;
BEGIN
    WITH spv_list AS (
        -- Get all active SPVs (Areas)
        SELECT id, name, employee_id
        FROM users
        WHERE role = 'spv' AND status = 'active'
    ),
    hierarchy_full AS (
        -- Get complete hierarchy with user details
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
        -- Get all promotor daily data
        SELECT 
            promoter_user_id,
            total_input,
            total_closed,
            total_pending,
            total_rejected
        FROM v_agg_daily_promoter_all
        WHERE agg_date = p_date::DATE
    ),
    area_hierarchy AS (
        -- Build complete hierarchy for each SPV/Area
        SELECT 
            spv.id as spv_id,
            spv.name as spv_name,
            COALESCE(h_spv.area, spv.name) as area_name,
            -- SATORs under this SPV
            json_agg(DISTINCT jsonb_build_object(
                'sator_id', h_sator.user_id,
                'sator_name', h_sator.name,
                'promotors', (
                    SELECT json_agg(
                        jsonb_build_object(
                            'user_id', h_prom.user_id,
                            'name', h_prom.name,
                            'total_input', COALESCE(pd.total_input, 0),
                            'total_closed', COALESCE(pd.total_closed, 0),
                            'total_pending', COALESCE(pd.total_pending, 0),
                            'total_rejected', COALESCE(pd.total_rejected, 0),
                            'is_empty', COALESCE(pd.total_input, 0) = 0,
                            'has_reject', COALESCE(pd.total_rejected, 0) > 0
                        ) ORDER BY CASE WHEN COALESCE(pd.total_input, 0) = 0 THEN 1 ELSE 0 END, pd.total_input DESC NULLS LAST
                    )
                    FROM hierarchy_full h_prom
                    LEFT JOIN promotor_daily pd ON pd.promoter_user_id = h_prom.user_id
                    WHERE h_prom.atasan_id = h_sator.user_id
                      AND h_prom.role = 'promotor'
                )
            )) FILTER (WHERE h_sator.user_id IS NOT NULL) as sators,
            -- Direct promotors under SPV (SPV as SATOR)
            (
                SELECT json_agg(
                    jsonb_build_object(
                        'user_id', h_direct.user_id,
                        'name', h_direct.name,
                        'total_input', COALESCE(pd.total_input, 0),
                        'total_closed', COALESCE(pd.total_closed, 0),
                        'total_pending', COALESCE(pd.total_pending, 0),
                        'total_rejected', COALESCE(pd.total_rejected, 0),
                        'is_empty', COALESCE(pd.total_input, 0) = 0,
                        'has_reject', COALESCE(pd.total_rejected, 0) > 0
                    ) ORDER BY CASE WHEN COALESCE(pd.total_input, 0) = 0 THEN 1 ELSE 0 END, pd.total_input DESC NULLS LAST
                )
                FROM hierarchy_full h_direct
                LEFT JOIN promotor_daily pd ON pd.promoter_user_id = h_direct.user_id
                WHERE h_direct.atasan_id = spv.id
                  AND h_direct.role = 'promotor'
            ) as direct_promotors
        FROM spv_list spv
        LEFT JOIN hierarchy_full h_spv ON h_spv.user_id = spv.id
        LEFT JOIN hierarchy_full h_sator ON h_sator.atasan_id = spv.id AND h_sator.role = 'sator'
        GROUP BY spv.id, spv.name, h_spv.area
    ),
    formatted_areas AS (
        SELECT 
            ah.spv_id as user_id,
            ah.area_name,
            ah.spv_name,
            -- Build complete sators array with aggregated totals
            (
                SELECT json_agg(
                    json_build_object(
                        'user_id', sator->>'sator_id',
                        'name', sator->>'sator_name',
                        'total_input', (SELECT COALESCE(SUM((p->>'total_input')::int), 0) FROM json_array_elements(sator->'promotors') p),
                        'total_closed', (SELECT COALESCE(SUM((p->>'total_closed')::int), 0) FROM json_array_elements(sator->'promotors') p),
                        'total_pending', (SELECT COALESCE(SUM((p->>'total_pending')::int), 0) FROM json_array_elements(sator->'promotors') p),
                        'total_rejected', (SELECT COALESCE(SUM((p->>'total_rejected')::int), 0) FROM json_array_elements(sator->'promotors') p),
                        'promotors', sator->'promotors'
                    ) ORDER BY (SELECT COALESCE(SUM((p->>'total_input')::int), 0) FROM json_array_elements(sator->'promotors') p) DESC
                )
                FROM json_array_elements(ah.sators) sator
                WHERE sator->>'sator_id' IS NOT NULL
            ) || 
            -- Add direct promotors as first "sator" if exists
            CASE 
                WHEN ah.direct_promotors IS NOT NULL THEN
                    json_build_array(
                        json_build_object(
                            'user_id', ah.spv_id,
                            'name', ah.spv_name || ' (Direct)',
                            'total_input', (SELECT COALESCE(SUM((p->>'total_input')::int), 0) FROM json_array_elements(ah.direct_promotors) p),
                            'total_closed', (SELECT COALESCE(SUM((p->>'total_closed')::int), 0) FROM json_array_elements(ah.direct_promotors) p),
                            'total_pending', (SELECT COALESCE(SUM((p->>'total_pending')::int), 0) FROM json_array_elements(ah.direct_promotors) p),
                            'total_rejected', (SELECT COALESCE(SUM((p->>'total_rejected')::int), 0) FROM json_array_elements(ah.direct_promotors) p),
                            'promotors', ah.direct_promotors
                        )
                    )
                ELSE '[]'::json
            END as sators
        FROM area_hierarchy ah
    ),
    areas_with_totals AS (
        SELECT 
            fa.user_id,
            fa.area_name,
            fa.spv_name,
            fa.sators,
            -- Calculate area totals from sators
            (SELECT COALESCE(SUM((s->>'total_input')::int), 0) FROM json_array_elements(fa.sators) s) as total_input,
            (SELECT COALESCE(SUM((s->>'total_closed')::int), 0) FROM json_array_elements(fa.sators) s) as total_closed,
            (SELECT COALESCE(SUM((s->>'total_pending')::int), 0) FROM json_array_elements(fa.sators) s) as total_pending,
            (SELECT COALESCE(SUM((s->>'total_rejected')::int), 0) FROM json_array_elements(fa.sators) s) as total_rejected
        FROM formatted_areas fa
    )
    -- Calculate statistics
    SELECT 
        COUNT(DISTINCT pd.promoter_user_id)::int,
        COUNT(DISTINCT CASE WHEN pd.total_input > 0 THEN pd.promoter_user_id END)::int,
        COUNT(DISTINCT CASE WHEN COALESCE(pd.total_input, 0) = 0 THEN hf.user_id END)::int,
        COUNT(DISTINCT CASE WHEN pd.total_rejected > 0 THEN pd.promoter_user_id END)::int
    INTO v_total_promotors, v_active_promotors, v_empty_promotors, v_reject_promotors
    FROM hierarchy_full hf
    LEFT JOIN promotor_daily pd ON pd.promoter_user_id = hf.user_id
    WHERE hf.role = 'promotor';
    
    -- Calculate grand totals
    SELECT 
        COALESCE(SUM(total_input), 0)::int as total_input,
        COALESCE(SUM(total_closed), 0)::int as total_closed,
        COALESCE(SUM(total_pending), 0)::int as total_pending,
        COALESCE(SUM(total_rejected), 0)::int as total_rejected
    INTO v_grand_totals
    FROM areas_with_totals;
    
    -- Build final result
    SELECT json_build_object(
        'date', p_date,
        'date_formatted', TO_CHAR(p_date::DATE, 'Day, DD Month YYYY'),
        'totals', json_build_object(
            'total_input', v_grand_totals.total_input,
            'total_closed', v_grand_totals.total_closed,
            'total_pending', v_grand_totals.total_pending,
            'total_rejected', v_grand_totals.total_rejected
        ),
        'promotor_stats', json_build_object(
            'total', v_total_promotors,
            'active', v_active_promotors,
            'empty', v_empty_promotors,
            'with_reject', v_reject_promotors
        ),
        'areas', (
            SELECT json_agg(
                json_build_object(
                    'user_id', user_id,
                    'area_name', area_name,
                    'spv_name', spv_name,
                    'total_input', total_input,
                    'total_closed', total_closed,
                    'total_pending', total_pending,
                    'total_rejected', total_rejected,
                    'sators', sators
                ) ORDER BY total_input DESC
            )
            FROM areas_with_totals
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_manager_daily_hierarchy(TEXT) TO authenticated, service_role;

-- ============================================================================
-- FUNCTION: get_manager_monthly_hierarchy
-- Purpose: Get complete Area → Sator → Promotor hierarchy for Manager (MONTHLY)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_manager_monthly_hierarchy(
    p_month TEXT  -- Format: 'YYYY-MM-01'
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_month_key TEXT;
    v_year INT;
    v_month INT;
BEGIN
    -- Parse month for targets
    v_month_key := SUBSTRING(p_month, 1, 7); -- 'YYYY-MM'
    v_year := CAST(SUBSTRING(p_month, 1, 4) AS INT);
    v_month := CAST(SUBSTRING(p_month, 6, 2) AS INT);
    
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
    -- Get all aggregate data
    spv_agg AS (
        SELECT * FROM v_agg_monthly_spv_all
        WHERE agg_month = p_month
    ),
    sator_agg AS (
        SELECT * FROM v_agg_monthly_sator_all
        WHERE agg_month = p_month
    ),
    promotor_agg AS (
        SELECT * FROM v_agg_monthly_promoter_all
        WHERE agg_month = p_month
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
    -- Build Sators (include SPV dual role)
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
        -- SPVs with direct promotors
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
        'areas', (SELECT json_agg(row_to_json(areas_data)) FROM areas_data),
        'sators', (SELECT json_agg(row_to_json(sators_combined)) FROM sators_combined),
        'promotors', (SELECT json_agg(row_to_json(promotors_data)) FROM promotors_data)
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_manager_monthly_hierarchy(TEXT) TO authenticated, service_role;

-- ============================================================================
-- End of Turbo RPC Functions
-- ============================================================================
