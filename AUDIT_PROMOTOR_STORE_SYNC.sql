-- AUDIT_PROMOTOR_STORE_SYNC.sql
-- Purpose:
-- Read-only audit untuk cek apakah assignment toko promotor di hierarchy
-- sudah sinkron dengan users.store_id.
--
-- Kategori hasil yang penting:
-- 1. hierarchy.store_id ada, tapi users.store_id NULL
-- 2. hierarchy.store_id beda dengan users.store_id
-- 3. promotor aktif tidak punya hierarchy.store_id

-- =========================================================
-- A. Detail mismatch promotor aktif
-- =========================================================
SELECT
    u.id AS user_id,
    u.name AS promotor_name,
    u.status,
    h.area,
    h.store_id AS hierarchy_store_id,
    hs.name AS hierarchy_store_name,
    u.store_id AS user_store_id,
    us.name AS user_store_name,
    CASE
        WHEN h.store_id IS NOT NULL AND u.store_id IS NULL THEN 'HIERARCHY_ONLY'
        WHEN h.store_id IS NULL AND u.store_id IS NOT NULL THEN 'USERS_ONLY'
        WHEN h.store_id IS DISTINCT FROM u.store_id THEN 'MISMATCH'
        ELSE 'SYNCED'
    END AS sync_status
FROM users u
LEFT JOIN hierarchy h
    ON h.user_id = u.id
LEFT JOIN stores hs
    ON hs.id = h.store_id
LEFT JOIN stores us
    ON us.id = u.store_id
WHERE u.role = 'promotor'
  AND u.status = 'active'
  AND (
      h.store_id IS DISTINCT FROM u.store_id
      OR h.store_id IS NULL
      OR u.store_id IS NULL
  )
ORDER BY sync_status, u.name;

-- =========================================================
-- B. Summary jumlah kasus
-- =========================================================
SELECT
    CASE
        WHEN h.store_id IS NOT NULL AND u.store_id IS NULL THEN 'HIERARCHY_ONLY'
        WHEN h.store_id IS NULL AND u.store_id IS NOT NULL THEN 'USERS_ONLY'
        WHEN h.store_id IS DISTINCT FROM u.store_id THEN 'MISMATCH'
        ELSE 'SYNCED'
    END AS sync_status,
    COUNT(*) AS total_promotor
FROM users u
LEFT JOIN hierarchy h
    ON h.user_id = u.id
WHERE u.role = 'promotor'
  AND u.status = 'active'
GROUP BY 1
ORDER BY 1;

-- =========================================================
-- C. Ringkasan per toko
-- =========================================================
SELECT
    COALESCE(hs.name, us.name, '(tanpa toko)') AS store_name,
    COUNT(*) AS total_promotor,
    COUNT(*) FILTER (
        WHERE h.store_id IS NOT NULL AND u.store_id IS NULL
    ) AS hierarchy_only,
    COUNT(*) FILTER (
        WHERE h.store_id IS NULL AND u.store_id IS NOT NULL
    ) AS users_only,
    COUNT(*) FILTER (
        WHERE h.store_id IS DISTINCT FROM u.store_id
          AND h.store_id IS NOT NULL
          AND u.store_id IS NOT NULL
    ) AS mismatch
FROM users u
LEFT JOIN hierarchy h
    ON h.user_id = u.id
LEFT JOIN stores hs
    ON hs.id = h.store_id
LEFT JOIN stores us
    ON us.id = u.store_id
WHERE u.role = 'promotor'
  AND u.status = 'active'
GROUP BY 1
ORDER BY 1;

-- =========================================================
-- D. Fokus toko SPC
-- =========================================================
SELECT
    s.name AS spc_store_name,
    u.name AS promotor_name,
    h.store_id AS hierarchy_store_id,
    u.store_id AS user_store_id,
    CASE
        WHEN h.store_id IS NOT NULL AND u.store_id IS NULL THEN 'HIERARCHY_ONLY'
        WHEN h.store_id IS NULL AND u.store_id IS NOT NULL THEN 'USERS_ONLY'
        WHEN h.store_id IS DISTINCT FROM u.store_id THEN 'MISMATCH'
        ELSE 'SYNCED'
    END AS sync_status
FROM stores s
LEFT JOIN hierarchy h
    ON h.store_id = s.id
LEFT JOIN users u
    ON u.id = h.user_id
WHERE s.is_spc = true
  AND (u.role = 'promotor' OR u.role IS NULL)
ORDER BY s.name, u.name;

-- =========================================================
-- E. Promotor aktif yang belum punya assignment toko di kedua sisi
-- =========================================================
SELECT
    u.id AS user_id,
    u.name AS promotor_name,
    u.status,
    h.area
FROM users u
LEFT JOIN hierarchy h
    ON h.user_id = u.id
WHERE u.role = 'promotor'
  AND u.status = 'active'
  AND h.store_id IS NULL
  AND u.store_id IS NULL
ORDER BY u.name;
