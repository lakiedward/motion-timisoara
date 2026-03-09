-- Add session-based payment fields to courses table
ALTER TABLE courses ADD COLUMN price_per_session BIGINT;
ALTER TABLE courses ADD COLUMN package_options TEXT;

-- Migrate existing courses: calculate price_per_session based on monthly price (assume ~8-10 sessions per month)
-- Using 8 sessions as conservative estimate for monthly frequency
UPDATE courses SET price_per_session = CAST(price / 8 AS BIGINT) WHERE price_per_session IS NULL;

-- Make price_per_session NOT NULL after migration
ALTER TABLE courses ALTER COLUMN price_per_session SET NOT NULL;

-- Add session tracking fields to enrollments table
ALTER TABLE enrollments ADD COLUMN purchased_sessions INT;
ALTER TABLE enrollments ADD COLUMN remaining_sessions INT;
ALTER TABLE enrollments ADD COLUMN sessions_used INT DEFAULT 0;

-- Migrate existing enrollments: give them 30 sessions as default (generous starting balance)
UPDATE enrollments SET purchased_sessions = 30 WHERE purchased_sessions IS NULL;
UPDATE enrollments SET remaining_sessions = 30 WHERE remaining_sessions IS NULL;
UPDATE enrollments SET sessions_used = 0 WHERE sessions_used IS NULL;

-- Make session fields NOT NULL after migration
ALTER TABLE enrollments ALTER COLUMN purchased_sessions SET NOT NULL;
ALTER TABLE enrollments ALTER COLUMN remaining_sessions SET NOT NULL;
ALTER TABLE enrollments ALTER COLUMN sessions_used SET NOT NULL;

-- Add a flag to monthly_payments to mark them as legacy
ALTER TABLE monthly_payments ADD COLUMN is_legacy BOOLEAN DEFAULT FALSE;
UPDATE monthly_payments SET is_legacy = TRUE;

-- Add index for better query performance
CREATE INDEX idx_enrollments_remaining_sessions ON enrollments(remaining_sessions);

