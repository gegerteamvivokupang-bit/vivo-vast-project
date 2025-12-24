-- VAST FINANCE - Add is_spc column to stores table
-- Untuk menandai toko yang masuk dalam grup SPC

-- 1. Tambah kolom is_spc ke tabel stores
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_spc BOOLEAN DEFAULT false;

-- 2. Buat index untuk performa query
CREATE INDEX IF NOT EXISTS idx_stores_is_spc ON stores(is_spc) WHERE is_spc = true;

-- 3. Comment untuk dokumentasi
COMMENT ON COLUMN stores.is_spc IS 'Menandakan toko ini adalah bagian dari SPC grup (Special Store Group)';
