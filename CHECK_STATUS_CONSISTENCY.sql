-- ============================================================================
-- VAST FINANCE - ANALISIS MASALAH STATUS DAN KONSISTENSI
-- Script untuk menemukan data yang menyebabkan ketidakcocokan
-- Created: 2026-02-19
-- ============================================================================

-- ============================================================================
-- MASALAH 1: KETIDAKKONSISTENAN KOLOM STATUS
-- Ada 3 kolom: status, approval_status, transaction_status
-- Perlu cek apakah ada konflik nilai
-- ============================================================================

SELECT 
    '1. KONFLIK STATUS COLUMNS' as analysis,
    status,
    approval_status,
    transaction_status,
    COUNT(*) as jumlah,
    CASE 
        -- KONFLIK: status ACC tapi approval_status bukan approved
        WHEN UPPER(status) = 'ACC' AND approval_status IS NOT NULL AND approval_status != 'approved' THEN '⚠️ KONFLIK: status=ACC tapi approval_status!=''approved'''
        -- KONFLIK: status REJECT tapi approval_status bukan rejected
        WHEN UPPER(status) = 'REJECT' AND approval_status IS NOT NULL AND approval_status != 'rejected' THEN '⚠️ KONFLIK: status=REJECT tapi approval_status!=''rejected'''
        -- KONFLIK: status PENDING tapi approval_status = approved AND transaction_status = closed
        WHEN UPPER(status) = 'PENDING' AND approval_status = 'approved' AND transaction_status = 'closed' THEN '⚠️ KONFLIK: status=PENDING tapi sudah approved+closed'
        -- KONFLIK: transaction_status closed tapi status bukan ACC
        WHEN transaction_status = 'closed' AND UPPER(status) != 'ACC' THEN '⚠️ KONFLIK: transaction_status=closed tapi status!=''ACC'''
        -- Normal
        ELSE '✅ Normal'
    END as issue
FROM vast_finance_data_new
WHERE deleted_at IS NULL
GROUP BY status, approval_status, transaction_status
ORDER BY jumlah DESC;

-- ============================================================================
-- MASALAH 2: DATA YANG DIHITUNG GANDA DALAM AGREGASI
-- Cek apakah ada data yang memenuhi lebih dari 1 kondisi FILTER
-- ============================================================================

-- Cek data yang bisa terhitung ganda untuk PENDING
SELECT 
    '2A. POTENTIAL DOUBLE COUNT - PENDING' as analysis,
    id,
    status,
    approval_status,
    transaction_status,
    sale_date,
    CASE 
        WHEN (approval_status = 'approved' AND transaction_status = 'not_closed') 
         AND UPPER(status) = 'PENDING' THEN '⚠️ MATCHED BOTH CONDITIONS'
        WHEN (approval_status = 'approved' AND transaction_status = 'not_closed') THEN 'Match: approval+transaction'
        WHEN UPPER(status) = 'PENDING' THEN 'Match: status=PENDING'
        ELSE 'No match'
    END as matched_condition
FROM vast_finance_data_new
WHERE deleted_at IS NULL
  AND (
    (approval_status = 'approved' AND transaction_status = 'not_closed')
    OR UPPER(status) = 'PENDING'
  )
ORDER BY sale_date DESC
LIMIT 50;

-- Cek data yang bisa terhitung ganda untuk CLOSED/ACC
SELECT 
    '2B. POTENTIAL DOUBLE COUNT - CLOSED/ACC' as analysis,
    id,
    status,
    approval_status,
    transaction_status,
    sale_date,
    CASE 
        WHEN transaction_status = 'closed' AND UPPER(status) = 'ACC' THEN '⚠️ MATCHED BOTH CONDITIONS'
        WHEN transaction_status = 'closed' THEN 'Match: transaction_status=closed'
        WHEN UPPER(status) = 'ACC' THEN 'Match: status=ACC'
        ELSE 'No match'
    END as matched_condition
FROM vast_finance_data_new
WHERE deleted_at IS NULL
  AND (transaction_status = 'closed' OR UPPER(status) = 'ACC')
ORDER BY sale_date DESC
LIMIT 50;

-- ============================================================================
-- MASALAH 3: DATA DENGAN STATUS NULL ATAU TIDAK DIKENAL
-- ============================================================================

SELECT 
    '3. STATUS NULL ATAU TIDAK DIKENAL' as analysis,
    id,
    status,
    approval_status,
    transaction_status,
    sale_date,
    customer_name,
    CASE 
        WHEN status IS NULL THEN '⚠️ status IS NULL'
        WHEN approval_status IS NULL AND transaction_status IS NULL THEN '⚠️ approval_status dan transaction_status NULL'
        WHEN UPPER(status) NOT IN ('ACC', 'REJECT', 'PENDING') THEN '⚠️ status tidak dikenal: ' || status
        ELSE '✅ OK'
    END as issue
FROM vast_finance_data_new
WHERE deleted_at IS NULL
  AND (
    status IS NULL
    OR (approval_status IS NULL AND transaction_status IS NULL)
    OR UPPER(status) NOT IN ('ACC', 'REJECT', 'PENDING')
  )
ORDER BY sale_date DESC
LIMIT 50;

-- ============================================================================
-- MASALAH 4: DATA YANG TIDAK MASUK KATEGORI APAPUN
-- Data yang statusnya tidak masuk PENDING, REJECT, atau CLOSED
-- ============================================================================

SELECT 
    '4. DATA TIDAK TERKATEGORI' as analysis,
    COUNT(*) as total_data,
    SUM(CASE 
        WHEN (approval_status = 'approved' AND transaction_status = 'not_closed') OR UPPER(status) = 'PENDING' THEN 1 
        ELSE 0 
    END) as count_pending,
    SUM(CASE 
        WHEN approval_status = 'rejected' OR UPPER(status) = 'REJECT' THEN 1 
        ELSE 0 
    END) as count_rejected,
    SUM(CASE 
        WHEN transaction_status = 'closed' OR UPPER(status) = 'ACC' THEN 1 
        ELSE 0 
    END) as count_closed,
    COUNT(*) - 
    SUM(CASE 
        WHEN (approval_status = 'approved' AND transaction_status = 'not_closed') OR UPPER(status) = 'PENDING' 
          OR approval_status = 'rejected' OR UPPER(status) = 'REJECT'
          OR transaction_status = 'closed' OR UPPER(status) = 'ACC' 
        THEN 1 ELSE 0 
    END) as uncounted
FROM vast_finance_data_new
WHERE DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
  AND deleted_at IS NULL;

-- ============================================================================
-- MASALAH 5: CEK VIEW vs TABEL LANGSUNG
-- Bandingkan hasil dari view v_agg_monthly_promoter_all dengan query langsung
-- ============================================================================

-- Dari View
SELECT 
    '5A. DARI VIEW v_agg_monthly_promoter_all' as source,
    SUM(total_input) as total_input,
    SUM(total_pending) as total_pending,
    SUM(total_rejected) as total_rejected,
    SUM(total_closed) as total_closed
FROM v_agg_monthly_promoter_all
WHERE agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE);

-- Dari Query Langsung (menggunakan logika yang sama dengan aggregation function)
SELECT 
    '5B. DARI QUERY LANGSUNG (vast_finance_data_new)' as source,
    COUNT(*) as total_input,
    COUNT(*) FILTER (WHERE (approval_status = 'approved' AND transaction_status = 'not_closed') OR UPPER(status) = 'PENDING') as total_pending,
    COUNT(*) FILTER (WHERE approval_status = 'rejected' OR UPPER(status) = 'REJECT') as total_rejected,
    COUNT(*) FILTER (WHERE transaction_status = 'closed' OR UPPER(status) = 'ACC') as total_closed
FROM vast_finance_data_new
WHERE DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)
  AND deleted_at IS NULL;

-- Dari agg_monthly_promoter tabel
SELECT 
    '5C. DARI TABEL agg_monthly_promoter' as source,
    SUM(total_input) as total_input,
    SUM(total_pending) as total_pending,
    SUM(total_rejected) as total_rejected,
    SUM(total_closed) as total_closed
FROM agg_monthly_promoter
WHERE agg_month = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE);

-- ============================================================================
-- MASALAH 6: CEK DATA LAMA (vast_finance_data_old) 
-- Apakah ada duplikasi dengan data baru?
-- ============================================================================

-- Cek apakah ada data di old yang overlap dengan data baru
SELECT 
    '6. CEK DATA LAMA vs DATA BARU' as analysis,
    (SELECT COUNT(*) FROM vast_finance_data_new WHERE deleted_at IS NULL) as new_data_count,
    (SELECT COUNT(*) FROM vast_finance_data_old) as old_data_count,
    (SELECT COUNT(DISTINCT DATE_TRUNC('month', sale_date)) FROM vast_finance_data_new WHERE deleted_at IS NULL) as new_months,
    (SELECT COUNT(DISTINCT DATE_TRUNC('month', sale_date)) FROM vast_finance_data_old) as old_months;

-- ============================================================================
-- MASALAH 7: CEK HIERARCHY YANG TIDAK LENGKAP
-- Promotor yang tidak punya atasan_id atau atasan tidak valid
-- ============================================================================

SELECT 
    '7. HIERARCHY TIDAK LENGKAP' as analysis,
    h.user_id,
    u.name as user_name,
    u.role,
    h.atasan_id,
    atasan.name as atasan_name,
    atasan.role as atasan_role,
    atasan.status as atasan_status,
    CASE 
        WHEN h.atasan_id IS NULL THEN '⚠️ atasan_id NULL'
        WHEN atasan.id IS NULL THEN '⚠️ atasan_id tidak ditemukan di users'
        WHEN atasan.status != 'active' THEN '⚠️ atasan tidak aktif'
        ELSE '✅ OK'
    END as issue
FROM hierarchy h
JOIN users u ON u.id = h.user_id
LEFT JOIN users atasan ON atasan.id = h.atasan_id
WHERE u.status = 'active'
ORDER BY issue DESC;

-- ============================================================================
-- MASALAH 8: CEK TARGET YANG TIDAK ADA
-- User aktif yang tidak punya target bulan ini
-- ============================================================================

SELECT 
    '8. USER AKTIF TANPA TARGET' as analysis,
    u.id,
    u.name,
    u.role,
    h.area,
    t.target_value,
    CASE 
        WHEN t.target_value IS NULL THEN '⚠️ Tidak ada target'
        WHEN t.target_value = 0 THEN '⚠️ Target = 0'
        ELSE '✅ Ada target'
    END as issue
FROM users u
JOIN hierarchy h ON h.user_id = u.id
LEFT JOIN targets t ON t.user_id = u.id 
    AND t.month = TO_CHAR((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE, 'YYYY-MM')
    AND (t.target_type = 'primary' OR t.target_type IS NULL)
WHERE u.status = 'active'
  AND u.role IN ('promotor', 'sator', 'spv')
ORDER BY u.role, issue DESC;

-- ============================================================================
-- MASALAH 9: CEK DOUBLE ENTRY DI VIEW (UNION ALL)
-- Karena view menggunakan UNION ALL, bisa ada duplikasi jika ID mapping tidak benar
-- ============================================================================

-- Cek apakah ada promotor yang punya data di tabel baru DAN lama untuk bulan yang sama
SELECT 
    '9. POTENTIAL DOUBLE ENTRY NEW + OLD' as analysis,
    COALESCE(m.new_id, old.promoter_id) as promoter_user_id,
    u.name as promotor_name,
    DATE_TRUNC('month', old.sale_date)::DATE as month,
    COUNT(*) as old_count,
    new.new_count,
    CASE 
        WHEN new.new_count > 0 THEN '⚠️ ADA DATA DI NEW DAN OLD'
        ELSE '✅ Hanya di old'
    END as issue
FROM vast_finance_data_old old
LEFT JOIN user_id_mapping_promotor m ON m.old_id = old.promoter_id
LEFT JOIN users u ON u.id = COALESCE(m.new_id, old.promoter_id)
LEFT JOIN (
    SELECT created_by_user_id, DATE_TRUNC('month', sale_date)::DATE as month, COUNT(*) as new_count
    FROM vast_finance_data_new
    WHERE deleted_at IS NULL
    GROUP BY created_by_user_id, DATE_TRUNC('month', sale_date)
) new ON new.created_by_user_id = COALESCE(m.new_id, old.promoter_id) 
    AND new.month = DATE_TRUNC('month', old.sale_date)
GROUP BY COALESCE(m.new_id, old.promoter_id), u.name, DATE_TRUNC('month', old.sale_date), new.new_count
HAVING new.new_count > 0
ORDER BY month DESC;

-- ============================================================================
-- RINGKASAN MASALAH
-- ============================================================================
SELECT 
    '=== RINGKASAN POTENSIAL MASALAH ===' as info,
    '1. Konflik antara kolom status, approval_status, transaction_status' as issue1,
    '2. Double counting dalam filter agregasi' as issue2,
    '3. Data dengan status NULL atau tidak dikenal' as issue3,
    '4. Data tidak terkategori (tidak masuk PENDING/REJECT/CLOSED)' as issue4,
    '5. Perbedaan antara view dan tabel agregasi' as issue5,
    '6. Duplikasi data lama dan baru' as issue6,
    '7. Hierarchy tidak lengkap' as issue7,
    '8. User aktif tanpa target' as issue8,
    '9. Double entry dari UNION ALL di view' as issue9;
