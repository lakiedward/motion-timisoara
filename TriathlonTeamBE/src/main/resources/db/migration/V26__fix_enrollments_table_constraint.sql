-- V26: Fix enrollment_kind constraint on the enrollments TABLE
-- The constraint was copied from the domain to the table when created
-- We need to drop the table constraint, not just the domain constraint

-- Drop the constraint from the enrollments table
ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_kind_check;

-- The domain constraint (from V25) already allows ACTIVITY
-- But we can also add the table constraint back with ACTIVITY if needed
-- ALTER TABLE enrollments ADD CONSTRAINT enrollments_kind_check CHECK (kind IN ('COURSE', 'CAMP', 'ACTIVITY'));
