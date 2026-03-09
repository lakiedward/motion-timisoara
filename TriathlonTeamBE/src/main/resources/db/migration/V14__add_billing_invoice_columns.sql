-- Add billing and invoice columns to payments table
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS billing_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS billing_address_line1 VARCHAR(255),
    ADD COLUMN IF NOT EXISTS billing_city VARCHAR(120),
    ADD COLUMN IF NOT EXISTS billing_postal_code VARCHAR(32),
    ADD COLUMN IF NOT EXISTS billing_country VARCHAR(2),
    ADD COLUMN IF NOT EXISTS invoice_url VARCHAR(2048),
    ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(255);
