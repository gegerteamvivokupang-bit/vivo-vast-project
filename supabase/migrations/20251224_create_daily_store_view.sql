-- VAST FINANCE - Create/Update Store Aggregate Views
-- View untuk agregat per toko dengan info lengkap dari tabel stores

-- View Daily Store
CREATE OR REPLACE VIEW v_agg_daily_store_all AS
SELECT
    s.id AS store_id,
    s.name AS store_name,
    s.area,
    s.is_spc,
    a.agg_date,
    COALESCE(a.total_input, 0) AS total_input,
    COALESCE(a.total_approved, 0) AS total_approved,
    COALESCE(a.total_rejected, 0) AS total_rejected,
    COALESCE(a.total_closed, 0) AS total_closed,
    COALESCE(a.total_pending, 0) AS total_pending,
    COALESCE(a.total_closing_direct, 0) AS total_closing_direct,
    COALESCE(a.total_closing_followup, 0) AS total_closing_followup
FROM stores s
LEFT JOIN agg_daily_store a ON s.id = a.store_id;

-- View Monthly Store (update untuk include kolom stores)
DROP VIEW IF EXISTS v_agg_monthly_store_all;
CREATE VIEW v_agg_monthly_store_all AS
SELECT
    s.id AS store_id,
    s.name AS store_name,
    s.area,
    s.is_spc,
    a.agg_month,
    COALESCE(a.total_input, 0) AS total_input,
    COALESCE(a.total_approved, 0) AS total_approved,
    COALESCE(a.total_rejected, 0) AS total_rejected,
    COALESCE(a.total_closed, 0) AS total_closed,
    COALESCE(a.total_pending, 0) AS total_pending,
    COALESCE(a.total_closing_direct, 0) AS total_closing_direct,
    COALESCE(a.total_closing_followup, 0) AS total_closing_followup
FROM stores s
LEFT JOIN agg_monthly_store a ON s.id = a.store_id;
