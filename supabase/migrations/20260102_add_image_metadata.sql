-- Add image metadata column for tracking cleanup
ALTER TABLE vast_finance_data_new 
ADD COLUMN IF NOT EXISTS image_urls_metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for cleanup queries (performance)
CREATE INDEX IF NOT EXISTS idx_image_retention_cleanup 
ON vast_finance_data_new(created_at) 
WHERE image_urls IS NOT NULL;

-- Add comment
COMMENT ON COLUMN vast_finance_data_new.image_urls_metadata IS 
'Stores Cloudinary public_ids and retention metadata for auto-cleanup. Schema: {cloudinary_public_ids: [], upload_date: ISO8601, retention_status: active|deleted, deleted_at: ISO8601|null}';
