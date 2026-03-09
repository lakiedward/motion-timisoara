-- V23: Add ACTIVITY to enrollment_kind domain
-- The domain enrollment_kind was created in V1 with only 'COURSE' and 'CAMP'
-- We need to add 'ACTIVITY' to support activity enrollments

-- Drop the existing constraint and add a new one with ACTIVITY included
ALTER DOMAIN enrollment_kind DROP CONSTRAINT IF EXISTS enrollment_kind_check;
ALTER DOMAIN enrollment_kind ADD CONSTRAINT enrollment_kind_check CHECK (VALUE IN ('COURSE', 'CAMP', 'ACTIVITY'));
