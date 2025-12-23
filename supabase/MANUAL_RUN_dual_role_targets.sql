-- ================================================================
-- MANUAL EXECUTION: Dual Role Target Support
-- ================================================================
-- Run this SQL directly in Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/gqvmdleyvwhznwjikivf/sql
-- ================================================================

-- Step 1: Add target_type column
ALTER TABLE targets 
ADD COLUMN IF NOT EXISTS target_type VARCHAR(10) DEFAULT 'primary';

-- Step 2: Drop old unique constraint
ALTER TABLE targets DROP CONSTRAINT IF EXISTS targets_user_period_unique;

-- Step 3: Add new unique constraint with target_type
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'targets_user_period_type_unique'
    ) THEN
        ALTER TABLE targets 
        ADD CONSTRAINT targets_user_period_type_unique 
        UNIQUE (user_id, period_month, period_year, target_type);
    END IF;
END $$;

-- Step 4: Create index for querying by target_type
CREATE INDEX IF NOT EXISTS idx_targets_user_period_type 
ON targets(user_id, period_year, period_month, target_type);

-- Step 5: Add comment
COMMENT ON COLUMN targets.target_type IS 'Target type: primary (default role), as_sator (for SPV acting as SATOR)';

-- ================================================================
-- VERIFICATION QUERY
-- ================================================================
-- Run this to verify the changes:
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'targets' 
ORDER BY ordinal_position;

-- Check constraint:
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'targets'::regclass;
