-- Script: Populate store_id untuk promotor
-- Purpose: Assign promotor ke toko berdasarkan submissions terbanyak
-- Date: 2024-12-24

-- Strategy: Untuk setiap promotor, assign ke toko dimana dia paling banyak submit

-- Preview dulu (jangan langsung update)
SELECT 
    u.id as user_id,
    u.name as promotor_name,
    u.role,
    most_active.store_id,
    s.name as store_name,
    most_active.submission_count
FROM users u
LEFT JOIN LATERAL (
    SELECT 
        store_id,
        COUNT(*) as submission_count
    FROM vast_finance_data_new
    WHERE created_by_user_id = u.id
      AND deleted_at IS NULL
    GROUP BY store_id
    ORDER BY COUNT(*) DESC
    LIMIT 1
) most_active ON true
LEFT JOIN stores s ON s.id = most_active.store_id
WHERE u.role = 'promotor'
ORDER BY u.name;

-- Uncomment untuk execute update (setelah verify hasil di atas OK)
/*
UPDATE users u
SET store_id = subq.store_id
FROM (
    SELECT DISTINCT ON (created_by_user_id)
        created_by_user_id as user_id,
        store_id,
        COUNT(*) as submission_count
    FROM vast_finance_data_new
    WHERE deleted_at IS NULL
    GROUP BY created_by_user_id, store_id
    ORDER BY created_by_user_id, COUNT(*) DESC
) subq
WHERE u.id = subq.user_id
  AND u.role = 'promotor'
  AND u.store_id IS NULL;
*/

-- Verify hasil update
SELECT 
    u.name,
    u.role,
    s.name as assigned_store,
    COUNT(v.id) as total_submissions
FROM users u
LEFT JOIN stores s ON s.id = u.store_id
LEFT JOIN vast_finance_data_new v ON v.created_by_user_id = u.id AND v.deleted_at IS NULL
WHERE u.role = 'promotor'
GROUP BY u.id, u.name, u.role, s.name
ORDER BY u.name;
