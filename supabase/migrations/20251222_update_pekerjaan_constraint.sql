-- Migration to update the allowed values for the 'pekerjaan' column in 'vast_finance_data_new' table.

-- 1. Drop existing constraint
ALTER TABLE IF EXISTS vast_finance_data_new DROP CONSTRAINT IF EXISTS vfdn_pekerjaan_check;

-- 2. Add new constraint with updated enum values but DO NOT validate existing data immediately (NOT VALID)
-- This ensures that existing rows with 'Lainnya' or 'Tidak Bekerja' are NOT deleted or cause errors.
ALTER TABLE IF EXISTS vast_finance_data_new 
ADD CONSTRAINT vfdn_pekerjaan_check 
CHECK (pekerjaan IN (
    'PNS', 
    'Pegawai Swasta', 
    'Buruh', 
    'Pelajar', 
    'IRT', 
    'Wiraswasta', 
    'TNI/Polri'
)) NOT VALID;
