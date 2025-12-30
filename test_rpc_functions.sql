-- Quick Test: Verify RPC Functions Exist
-- Run this in Supabase SQL Editor to verify deployment

-- Test 1: Check if get_manager_monthly_hierarchy exists
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname LIKE '%manager%hierarchy%';

-- Test 2: Check if all Turbo RPC functions exist
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname IN (
    'get_team_monthly_data',
    'get_team_daily_data', 
    'get_team_daily_with_sators',
    'get_manager_daily_hierarchy',
    'get_manager_monthly_hierarchy'
);

-- Test 3: Try calling the function (will error if not exist)
-- SELECT * FROM get_manager_monthly_hierarchy('2025-01-01') LIMIT 1;
