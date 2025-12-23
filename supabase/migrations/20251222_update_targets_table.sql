-- Add missing columns to existing targets table
-- Table is currently empty, so no data migration needed

-- Add period_month and period_year for easier querying
ALTER TABLE targets 
ADD COLUMN IF NOT EXISTS period_month INTEGER,
ADD COLUMN IF NOT EXISTS period_year INTEGER,
ADD COLUMN IF NOT EXISTS set_by_admin_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_targets_user_period ON targets(user_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_targets_period ON targets(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_targets_admin ON targets(set_by_admin_id);

-- Add unique constraint on user_id, period_month, period_year
-- (one target per user per month)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'targets_user_period_unique'
    ) THEN
        ALTER TABLE targets 
        ADD CONSTRAINT targets_user_period_unique 
        UNIQUE (user_id, period_month, period_year);
    END IF;
END $$;

-- Add comments
COMMENT ON COLUMN targets.period_month IS 'Target month (1-12)';
COMMENT ON COLUMN targets.period_year IS 'Target year';
COMMENT ON COLUMN targets.set_by_admin_id IS 'Admin who set this target (for audit trail)';
