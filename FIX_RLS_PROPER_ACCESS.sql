-- ============================================================================
-- PROPER SOLUTION: RLS Policy untuk Manager akses data promotor di area-nya
-- Ini lebih proper daripada bypass dengan Edge Function
-- ============================================================================

-- ============================================
-- 1. CEK EXISTING RLS POLICIES
-- ============================================
-- SELECT 
--     schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies 
-- WHERE tablename = 'vast_finance_data_new';

-- ============================================
-- 2. CREATE POLICY: Manager dapat SELECT data di area-nya
-- ============================================

-- Drop existing manager policy if exists (to avoid duplicate)
DROP POLICY IF EXISTS "manager_select_area_data" ON vast_finance_data_new;

-- Create new policy: Manager can view ALL submissions from promotors in their area
CREATE POLICY "manager_select_area_data" ON vast_finance_data_new
    FOR SELECT
    TO authenticated
    USING (
        -- Check if current user is a manager
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'manager'
        )
        AND
        -- Check if the submission creator is in the same area as the manager
        EXISTS (
            SELECT 1 
            FROM hierarchy manager_h
            JOIN hierarchy promotor_h ON promotor_h.area = manager_h.area
            WHERE manager_h.user_id = auth.uid()
            AND promotor_h.user_id = vast_finance_data_new.created_by_user_id
        )
    );

-- ============================================
-- 3. CREATE POLICY: SPV dapat SELECT data tim-nya (jika belum ada)
-- ============================================

DROP POLICY IF EXISTS "spv_select_team_data" ON vast_finance_data_new;

CREATE POLICY "spv_select_team_data" ON vast_finance_data_new
    FOR SELECT
    TO authenticated
    USING (
        -- Check if current user is SPV
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'spv'
        )
        AND
        -- Check if submission creator is under this SPV's hierarchy
        EXISTS (
            SELECT 1 
            FROM hierarchy h
            WHERE h.atasan_id = auth.uid()  -- Direct reports to SPV
            AND (
                h.user_id = vast_finance_data_new.created_by_user_id  -- Direct promotor
                OR EXISTS (  -- Or promotor under SATOR who reports to SPV
                    SELECT 1 FROM hierarchy h2
                    WHERE h2.atasan_id = h.user_id
                    AND h2.user_id = vast_finance_data_new.created_by_user_id
                )
            )
        )
    );

-- ============================================
-- 4. CREATE POLICY: SATOR dapat SELECT data tim-nya (jika belum ada)
-- ============================================

DROP POLICY IF EXISTS "sator_select_team_data" ON vast_finance_data_new;

CREATE POLICY "sator_select_team_data" ON vast_finance_data_new
    FOR SELECT
    TO authenticated
    USING (
        -- Check if current user is SATOR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'sator'
        )
        AND
        -- Check if submission creator is direct report to this SATOR
        EXISTS (
            SELECT 1 
            FROM hierarchy h
            WHERE h.atasan_id = auth.uid()
            AND h.user_id = vast_finance_data_new.created_by_user_id
        )
    );

-- ============================================
-- 5. VERIFY: List all policies after creation
-- ============================================
SELECT 
    policyname,
    cmd,
    CASE WHEN permissive = 'PERMISSIVE' THEN 'Allow' ELSE 'Deny' END as type
FROM pg_policies 
WHERE tablename = 'vast_finance_data_new'
ORDER BY policyname;
