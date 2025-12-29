-- ============================================================================
-- CEK CONSTRAINT PEKERJAAN YANG VALID
-- ============================================================================

-- Query untuk lihat constraint check
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'vast_finance_data_new'::regclass
  AND conname LIKE '%pekerjaan%';

-- Alternative: Cek dari column comment/description
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'vast_finance_data_new'
  AND column_name = 'pekerjaan';
