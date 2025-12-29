-- ============================================================================
-- CEK CONSTRAINT SOURCE YANG VALID
-- ============================================================================

SELECT 
    conname,
    pg_get_constraintdef(oid) 
FROM pg_constraint
WHERE conrelid = 'vast_finance_data_new'::regclass
  AND conname LIKE '%source%';
