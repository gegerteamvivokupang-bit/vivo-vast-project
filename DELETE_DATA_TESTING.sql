-- ============================================================================
-- HAPUS DATA TESTING (dengan Foreign Key Constraint)
-- ============================================================================

-- STEP 1: Hapus data di tabel conversions (yang reference ke vast_finance_data_new)
DELETE FROM conversions;

-- Verify conversions kosong
SELECT COUNT(*) FROM conversions;
-- Expected: 0

-- STEP 2: Hapus data di vast_finance_data_new
DELETE FROM vast_finance_data_new;

-- Verify vast_finance_data_new kosong
SELECT COUNT(*) FROM vast_finance_data_new;
-- Expected: 0

-- ============================================================================
-- SELESAI! Sekarang siap execute migration_desember2025_FINAL.sql
-- ============================================================================
