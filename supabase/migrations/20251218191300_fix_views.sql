
-- VAST FINANCE - Fix View for Aggregates
-- Re-create the VIEW to ensure it pulls correctly from the aggregated table
-- This forces the Dashboard to see the correct count (6)

CREATE OR REPLACE VIEW v_agg_monthly_promoter_all AS
SELECT 
    promoter_user_id,
    agg_month,
    total_input,
    total_approved,
    total_rejected,
    total_closed,
    total_pending,
    total_closing_direct,
    total_closing_followup
FROM agg_monthly_promoter;

-- Also fix Daily View just in case
CREATE OR REPLACE VIEW v_agg_daily_promoter_all AS
SELECT 
    promoter_user_id,
    agg_date,
    total_input,
    total_approved,
    total_rejected,
    total_closed,
    total_pending,
    total_closing_direct,
    total_closing_followup
FROM agg_daily_promoter;
