-- Add paid_at column to payments table
ALTER TABLE payments ADD COLUMN paid_at TIMESTAMPTZ;

-- Populate existing SUCCEEDED cash payments with updated_at value
UPDATE payments
SET paid_at = updated_at
WHERE status = 'SUCCEEDED' AND method = 'CASH';

