-- ============================================================================
-- CEK TABEL CONVERSIONS - Struktur dan Data
-- ============================================================================

-- 1. CEK APAKAH TABEL ADA
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'conversions'
        ) THEN '✅ Tabel conversions ADA'
        ELSE '❌ Tabel conversions TIDAK ADA'
    END as status;

-- 2. LIHAT STRUKTUR KOLOM TABEL
SELECT 
    column_name as "Nama Kolom",
    data_type as "Tipe Data",
    is_nullable as "Nullable",
    column_default as "Default Value"
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'conversions'
ORDER BY ordinal_position;

-- 3. LIHAT CONSTRAINTS (Primary Key, Foreign Key, dll)
SELECT
    tc.constraint_name as "Constraint Name",
    tc.constraint_type as "Type",
    kcu.column_name as "Column"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'conversions'
ORDER BY tc.constraint_type, tc.constraint_name;

-- 4. LIHAT INDEXES
SELECT
    indexname as "Index Name",
    indexdef as "Definition"
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'conversions';

-- 5. CEK JUMLAH DATA
SELECT 
    COUNT(*) as "Total Rows di Tabel Conversions"
FROM conversions;

-- 6. LIHAT SAMPLE DATA (5 rows pertama)
SELECT * 
FROM conversions 
LIMIT 5;

-- 7. CEK RELASI KE TABEL LAIN
SELECT 
    'Relasi ke vast_finance_data_new' as info,
    COUNT(*) as total_conversions_dengan_transaction_id
FROM conversions
WHERE transaction_id IS NOT NULL;

-- 8. CEK APAKAH ADA TRIGGER
SELECT 
    tgname as "Trigger Name",
    CASE 
        WHEN tgtype = 29 THEN 'FOR EACH ROW' 
        WHEN tgtype = 23 THEN 'FOR EACH STATEMENT'
        ELSE 'Other'
    END as "Trigger Type",
    tgenabled as "Enabled"
FROM pg_trigger
WHERE tgrelid = 'conversions'::regclass
  AND NOT tgisinternal;
