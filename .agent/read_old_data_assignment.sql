-- READ DATA FROM vast_finance_data_old
-- Purpose: Lihat assignment promotor-toko dari data lama

-- 1. Cek struktur table vast_finance_data_old
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'vast_finance_data_old'
ORDER BY ordinal_position;

-- 2. Sample data dari vast_finance_data_old
SELECT *
FROM vast_finance_data_old
LIMIT 10;

-- 3. Lihat promotor dan toko dari data lama
SELECT 
    promoter_id,
    promoter_name,
    store_id,
    store_name,
    COUNT(*) as total_submissions
FROM vast_finance_data_old
GROUP BY promoter_id, promoter_name, store_id, store_name
ORDER BY promoter_name, COUNT(*) DESC;

-- 4. Cek apakah setiap promotor punya 1 toko atau banyak
SELECT 
    promoter_name,
    COUNT(DISTINCT store_id) as jumlah_toko_berbeda,
    STRING_AGG(DISTINCT store_name, ', ') as toko_list
FROM vast_finance_data_old
GROUP BY promoter_name
ORDER BY COUNT(DISTINCT store_id) DESC;

-- 5. Untuk setiap promotor, ambil toko dengan submission terbanyak
SELECT DISTINCT ON (promoter_id)
    promoter_id,
    promoter_name,
    store_id,
    store_name,
    submission_count
FROM (
    SELECT 
        promoter_id,
        promoter_name,
        store_id,
        store_name,
        COUNT(*) as submission_count
    FROM vast_finance_data_old
    GROUP BY promoter_id, promoter_name, store_id, store_name
) subq
ORDER BY promoter_id, submission_count DESC;

-- 6. Map promoter_id lama ke user_id baru (via mapping table)
SELECT 
    old.promoter_id as old_id,
    old.promoter_name,
    m.new_id as user_id,
    u.name as user_name,
    old.store_id,
    old.store_name
FROM (
    SELECT DISTINCT ON (promoter_id)
        promoter_id,
        promoter_name,
        store_id,
        store_name
    FROM (
        SELECT 
            promoter_id,
            promoter_name,
            store_id,
            store_name,
            COUNT(*) as cnt
        FROM vast_finance_data_old
        GROUP BY promoter_id, promoter_name, store_id, store_name
    ) x
    ORDER BY promoter_id, cnt DESC
) old
LEFT JOIN user_id_mapping_promotor m ON m.old_id = old.promoter_id
LEFT JOIN users u ON u.id = m.new_id
ORDER BY old.promoter_name;

-- 7. FINAL: Update users.store_id berdasarkan data lama
-- (Preview dulu, jangan langsung execute!)
SELECT 
    u.id as user_id,
    u.name as user_name,
    s.id as will_assign_store_id,
    s.name as will_assign_store_name,
    old_data.old_store_name as from_old_data
FROM users u
LEFT JOIN LATERAL (
    SELECT DISTINCT ON (old.promoter_id)
        old.promoter_id,
        old.store_id as old_store_id,
        old.store_name as old_store_name
    FROM vast_finance_data_old old
    LEFT JOIN user_id_mapping_promotor m ON m.old_id = old.promoter_id
    WHERE m.new_id = u.id
    ORDER BY old.promoter_id, (
        SELECT COUNT(*) 
        FROM vast_finance_data_old 
        WHERE promoter_id = old.promoter_id 
          AND store_id = old.store_id
    ) DESC
) old_data ON true
LEFT JOIN stores s ON s.name = old_data.old_store_name OR s.id = old_data.old_store_id
WHERE u.role = 'promotor'
ORDER BY u.name;
