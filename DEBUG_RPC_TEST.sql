-- ============================================
-- DEBUG: Test RPC Function Directly
-- Run each query one by one to find the issue
-- ============================================

-- 1. Test get_team_monthly_data with a known SPV ID
-- Replace 'fc769700-99f5-4177-9f18-a4bb906fedfc' with actual SPV ID
SELECT * FROM get_team_monthly_data(
    'fc769700-99f5-4177-9f18-a4bb906fedfc'::UUID,
    '2026-01-01'
);

-- 2. If error, check the function definition
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'get_team_monthly_data';

-- 3. Check if there are any issues with the targets table schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'targets';
