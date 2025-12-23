-- Support Dual Role: Allow SPV to have 2 targets (as SPV and as SATOR)
-- Migration: Add target_type to differentiate target purpose

-- Step 1: Add target_type column
ALTER TABLE targets 
ADD COLUMN IF NOT EXISTS target_type VARCHAR(10) DEFAULT 'primary';

-- Step 2: Drop old unique constraint
ALTER TABLE targets DROP CONSTRAINT IF EXISTS targets_user_period_unique;

-- Step 3: Add new unique constraint with target_type
ALTER TABLE targets 
ADD CONSTRAINT targets_user_period_type_unique 
UNIQUE (user_id, period_month, period_year, target_type);

-- Step 4: Create index for querying by target_type
CREATE INDEX IF NOT EXISTS idx_targets_user_period_type ON targets(user_id, period_year, period_month, target_type);

-- Add comment
COMMENT ON COLUMN targets.target_type IS 'Target type: primary (default role), as_sator (for SPV acting as SATOR)';

-- ================================================================
-- USAGE EXAMPLES:
-- ================================================================
--
-- 1. SPV Wilibroddus target as SPV (area besar):
--    INSERT INTO targets (user_id, period_month, period_year, target_type, target_value)
--    VALUES ('wili-uuid', 12, 2024, 'primary', 1000);
--
-- 2. SPV Wilibroddus target as SATOR (promotor langsung):
--    INSERT INTO targets (user_id, period_month, period_year, target_type, target_value)
--    VALUES ('wili-uuid', 12, 2024, 'as_sator', 200);
--
-- 3. Regular SATOR hanya punya 1 target:
--    INSERT INTO targets (user_id, period_month, period_year, target_type, target_value)
--    VALUES ('sator-uuid', 12, 2024, 'primary', 150);
--
-- ================================================================
