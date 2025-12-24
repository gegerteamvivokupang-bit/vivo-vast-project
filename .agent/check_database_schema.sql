-- SCRIPT: Check Database Schema
-- Purpose: Melihat struktur table dan view yang sebenarnya untuk menghindari asumsi

-- ==================================================
-- 1. LIST ALL TABLES
-- ==================================================
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- ==================================================
-- 2. CEK STRUKTUR TABLE vast_finance_data_new (jika ada)
-- ==================================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'vast_finance_data_new'
ORDER BY ordinal_position;

-- ==================================================
-- 3. CEK STRUKTUR TABLE vast_finance_data_old (jika ada)
-- ==================================================
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'vast_finance_data_old'
ORDER BY ordinal_position;

-- ==================================================
-- 4. CARI SEMUA TABLE YANG MENGANDUNG KATA "finance"
-- ==================================================
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name ILIKE '%finance%'
ORDER BY table_name;

-- ==================================================
-- 5. CARI SEMUA TABLE YANG MENGANDUNG KATA "submission"
-- ==================================================
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name ILIKE '%submission%'
ORDER BY table_name;

-- ==================================================
-- 6. LIST ALL VIEWS
-- ==================================================
SELECT 
    table_name as view_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'VIEW'
ORDER BY table_name;

-- ==================================================
-- 7. CEK COLUMNS DI SEMUA TABLE YANG PUNYA "store_id"
-- ==================================================
SELECT DISTINCT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'store_id'
ORDER BY table_name;

-- ==================================================
-- 8. CEK COLUMNS DI SEMUA TABLE YANG PUNYA "promoter" atau "promotor"
-- ==================================================
SELECT DISTINCT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (column_name ILIKE '%promoter%' OR column_name ILIKE '%promotor%')
ORDER BY table_name, column_name;

-- ==================================================
-- 9. CEK TABLE users STRUCTURE
-- ==================================================
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users'
ORDER BY ordinal_position;

-- ==================================================
-- 10. CEK TABLE stores STRUCTURE
-- ==================================================
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'stores'
ORDER BY ordinal_position;

-- ==================================================
-- 11. CEK SAMPLE DATA dari table yang mengandung store_id DAN promoter
-- (Untuk melihat table mana yang benar-benar ada data)
-- ==================================================
-- Uncomment yang relevan setelah tahu table name yang benar

-- SELECT table_name, COUNT(*) as row_count
-- FROM (
--     SELECT 'vast_finance_data_new' as table_name FROM vast_finance_data_new LIMIT 1
--     UNION ALL
--     SELECT 'vast_finance_data_old' FROM vast_finance_data_old LIMIT 1
-- ) t
-- GROUP BY table_name;
