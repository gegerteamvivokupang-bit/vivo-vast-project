-- ============================================
-- CHECK RPC FUNCTIONS STATUS
-- Run this to check if all functions exist
-- ============================================

-- Check if all functions exist
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'get_team_monthly_data',
    'get_team_daily_with_sators',
    'get_team_daily_data',
    'get_manager_monthly_hierarchy',
    'get_manager_daily_hierarchy'
)
ORDER BY routine_name;

-- If any function is missing, run FIX_INACTIVE_USER_FILTER.sql again
