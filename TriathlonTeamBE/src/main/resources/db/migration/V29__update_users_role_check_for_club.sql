-- V29: Update users role check constraint to include CLUB role
-- Problem: The existing CHECK constraint on users.role doesn't include 'CLUB'

-- Drop the existing constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new constraint that includes CLUB role
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('ADMIN', 'COACH', 'PARENT', 'CLUB'));

-- Log the change
DO $$
BEGIN
    RAISE NOTICE 'Updated users_role_check constraint to include CLUB role';
END $$;
