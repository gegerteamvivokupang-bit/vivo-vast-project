-- Make 'month' column nullable since we are using period_month/year now
ALTER TABLE targets ALTER COLUMN month DROP NOT NULL;
