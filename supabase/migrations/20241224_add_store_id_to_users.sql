-- Migration: Add store_id to users table
-- Purpose: Direct relationship antara promotor dan toko
-- Date: 2024-12-24

-- 1. Add column store_id to users (if not exists)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);

-- 2. Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_store_id ON users(store_id);

-- 3. Add index for query promotor by store
CREATE INDEX IF NOT EXISTS idx_users_role_store ON users(role, store_id) WHERE role = 'promotor';

-- 4. Comment for documentation
COMMENT ON COLUMN users.store_id IS 'Store assignment for promotor role - direct relationship to stores table';
