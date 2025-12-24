-- TEST QUERY: Cek apakah ada data di vast_finance_data_new bulan ini

-- 1. Cek total data di table
SELECT COUNT(*) as total_rows
FROM vast_finance_data_new
WHERE deleted_at IS NULL;

-- 2. Cek data bulan Desember 2024
SELECT 
    COUNT(*) as rows_this_month,
    COUNT(DISTINCT store_id) as unique_stores,
    COUNT(DISTINCT created_by_user_id) as unique_promotors,
    MIN(sale_date) as earliest_date,
    MAX(sale_date) as latest_date
FROM vast_finance_data_new
WHERE sale_date >= '2024-12-01'
  AND sale_date < '2025-01-01'
  AND deleted_at IS NULL;

-- 3. Cek per store untuk bulan Desember
SELECT 
    s.name as store_name,
    s.id as store_id,
    s.is_spc,
    COUNT(v.id) as submission_count,
    COUNT(DISTINCT v.created_by_user_id) as promotor_count
FROM stores s
LEFT JOIN vast_finance_data_new v 
    ON v.store_id = s.id 
    AND v.sale_date >= '2024-12-01'
    AND v.sale_date < '2025-01-01'
    AND v.deleted_at IS NULL
WHERE s.is_spc = true
GROUP BY s.id, s.name, s.is_spc
ORDER BY submission_count DESC;

-- 4. Cek sample data dari SPC store pertama
SELECT 
    id,
    created_by_user_id,
    store_id,
    sale_date,
    customer_name,
    status
FROM vast_finance_data_new
WHERE store_id IN (
    SELECT id FROM stores WHERE is_spc = true LIMIT 1
)
AND sale_date >= '2024-12-01'
AND deleted_at IS NULL
LIMIT 5;

-- 5. Cek apakah ada data di bulan-bulan lain (untuk verify table tidak kosong)
SELECT 
    DATE_TRUNC('month', sale_date)::DATE as month,
    COUNT(*) as rows,
    COUNT(DISTINCT store_id) as stores,
    COUNT(DISTINCT created_by_user_id) as promotors
FROM vast_finance_data_new
WHERE deleted_at IS NULL
GROUP BY DATE_TRUNC('month', sale_date)
ORDER BY month DESC
LIMIT 6;
