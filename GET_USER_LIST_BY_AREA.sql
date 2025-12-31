-- ============================================
-- USER LIST BY HIERARCHY
-- Jalankan di Supabase SQL Editor
-- ============================================

-- AREA KUPANG (SPV: GERY B DAHOKLORY)
SELECT 
    '📍 KUPANG' as area,
    CASE 
        WHEN u.role = 'spv' THEN '👔 SPV'
        WHEN u.role = 'sator' THEN '👷 SATOR'
        WHEN u.role = 'promotor' THEN '🛒 Promotor'
    END as role_label,
    u.name,
    u.email,
    u.employee_id,
    atasan.name as atasan
FROM users u
LEFT JOIN hierarchy h ON h.user_id = u.id
LEFT JOIN users atasan ON atasan.id = h.atasan_id
WHERE u.status = 'active'
AND (
    u.id = 'fc769700-99f5-4177-9f18-a4bb906fedfc'  -- SPV Gery
    OR h.atasan_id = 'fc769700-99f5-4177-9f18-a4bb906fedfc' -- Under Gery
    OR h.atasan_id IN (
        SELECT user_id FROM hierarchy WHERE atasan_id = 'fc769700-99f5-4177-9f18-a4bb906fedfc'
    ) -- Under Gery's SATORs
)
ORDER BY 
    CASE u.role WHEN 'spv' THEN 1 WHEN 'sator' THEN 2 WHEN 'promotor' THEN 3 END,
    u.name;

-- AREA KABUPATEN (SPV: WILIBRODUS SAMARA)
SELECT 
    '📍 KABUPATEN' as area,
    CASE 
        WHEN u.role = 'spv' THEN '👔 SPV'
        WHEN u.role = 'sator' THEN '👷 SATOR'
        WHEN u.role = 'promotor' THEN '🛒 Promotor'
    END as role_label,
    u.name,
    u.email,
    u.employee_id,
    atasan.name as atasan
FROM users u
LEFT JOIN hierarchy h ON h.user_id = u.id
LEFT JOIN users atasan ON atasan.id = h.atasan_id
WHERE u.status = 'active'
AND (
    u.id = '80de3717-971e-4877-bdbc-05464dadb12f'  -- SPV Wilibrodus
    OR h.atasan_id = '80de3717-971e-4877-bdbc-05464dadb12f' -- Under Wilibrodus
    OR h.atasan_id IN (
        SELECT user_id FROM hierarchy WHERE atasan_id = '80de3717-971e-4877-bdbc-05464dadb12f'
    ) -- Under Wilibrodus's SATORs
)
ORDER BY 
    CASE u.role WHEN 'spv' THEN 1 WHEN 'sator' THEN 2 WHEN 'promotor' THEN 3 END,
    u.name;

-- AREA SUMBA (SPV: ANFAL JUPRIADI)
SELECT 
    '📍 SUMBA' as area,
    CASE 
        WHEN u.role = 'spv' THEN '👔 SPV'
        WHEN u.role = 'sator' THEN '👷 SATOR'
        WHEN u.role = 'promotor' THEN '🛒 Promotor'
    END as role_label,
    u.name,
    u.email,
    u.employee_id,
    atasan.name as atasan
FROM users u
LEFT JOIN hierarchy h ON h.user_id = u.id
LEFT JOIN users atasan ON atasan.id = h.atasan_id
WHERE u.status = 'active'
AND (
    u.id = 'da2b9114-6e1c-4be3-8ecd-fa54d79ebd86'  -- SPV Anfal
    OR h.atasan_id = 'da2b9114-6e1c-4be3-8ecd-fa54d79ebd86' -- Under Anfal
    OR h.atasan_id IN (
        SELECT user_id FROM hierarchy WHERE atasan_id = 'da2b9114-6e1c-4be3-8ecd-fa54d79ebd86'
    ) -- Under Anfal's SATORs
)
ORDER BY 
    CASE u.role WHEN 'spv' THEN 1 WHEN 'sator' THEN 2 WHEN 'promotor' THEN 3 END,
    u.name;

-- MANAGER & ADMIN
SELECT 
    '🏢 MANAGEMENT' as area,
    CASE 
        WHEN u.role = 'manager' THEN '📊 Manager'
        WHEN u.role = 'admin' THEN '⚙️ Admin'
    END as role_label,
    u.name,
    u.email,
    u.employee_id,
    NULL as atasan
FROM users u
WHERE u.status = 'active'
AND u.role IN ('manager', 'admin')
ORDER BY u.role, u.name;
