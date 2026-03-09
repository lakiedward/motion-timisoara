-- V24: Fix enrollment_kind to include ACTIVITY
-- V23 was marked as applied but the constraint wasn't actually updated
-- This migration will properly update the domain constraint

-- Drop the existing constraint and add a new one with ACTIVITY included
ALTER DOMAIN enrollment_kind DROP CONSTRAINT IF EXISTS enrollment_kind_check;
ALTER DOMAIN enrollment_kind ADD CONSTRAINT enrollment_kind_check CHECK (VALUE IN ('COURSE', 'CAMP', 'ACTIVITY'));
