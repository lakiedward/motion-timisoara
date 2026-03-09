-- Create monthly_payments table for recurring monthly payments
CREATE TABLE monthly_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    month_year VARCHAR(7) NOT NULL,
    amount BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'RON',
    method VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT unique_enrollment_month UNIQUE(enrollment_id, month_year)
);

-- Create indexes for performance
CREATE INDEX idx_monthly_payments_enrollment ON monthly_payments(enrollment_id);
CREATE INDEX idx_monthly_payments_status ON monthly_payments(status);
CREATE INDEX idx_monthly_payments_month_year ON monthly_payments(month_year);

-- Add first_session_date to enrollments for tracking payment cycles
ALTER TABLE enrollments ADD COLUMN first_session_date DATE;

