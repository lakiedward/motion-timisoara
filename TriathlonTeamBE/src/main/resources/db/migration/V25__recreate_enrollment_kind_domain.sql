-- V25: Recreate enrollment_kind domain with ACTIVITY support
-- Previous migrations failed because the constraint name might differ

-- First, we need to drop all constraints on the domain
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    FOR constraint_name IN 
        SELECT conname FROM pg_constraint 
        WHERE contypid = 'enrollment_kind'::regtype
    LOOP
        EXECUTE format('ALTER DOMAIN enrollment_kind DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

-- Now add the new constraint with ACTIVITY included
ALTER DOMAIN enrollment_kind ADD CONSTRAINT enrollment_kind_check 
    CHECK (VALUE IN ('COURSE', 'CAMP', 'ACTIVITY'));
