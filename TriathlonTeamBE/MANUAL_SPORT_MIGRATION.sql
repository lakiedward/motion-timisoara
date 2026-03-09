-- Manual migration script to convert existing course.sport from String to foreign key
-- Run this ONLY if you have existing data and migration V6 hasn't been applied yet

-- Step 1: Check if sports exist, if not create them
INSERT INTO sports (id, code, name)
SELECT gen_random_uuid(), 'swim', 'Înot'
WHERE NOT EXISTS (SELECT 1 FROM sports WHERE code = 'swim');

INSERT INTO sports (id, code, name)
SELECT gen_random_uuid(), 'bike', 'Ciclism'
WHERE NOT EXISTS (SELECT 1 FROM sports WHERE code = 'bike');

INSERT INTO sports (id, code, name)
SELECT gen_random_uuid(), 'run', 'Alergare'
WHERE NOT EXISTS (SELECT 1 FROM sports WHERE code = 'run');

INSERT INTO sports (id, code, name)
SELECT gen_random_uuid(), 'inot', 'Înot'
WHERE NOT EXISTS (SELECT 1 FROM sports WHERE code = 'inot');

INSERT INTO sports (id, code, name)
SELECT gen_random_uuid(), 'ciclism', 'Ciclism'
WHERE NOT EXISTS (SELECT 1 FROM sports WHERE code = 'ciclism');

INSERT INTO sports (id, code, name)
SELECT gen_random_uuid(), 'alergare', 'Alergare'
WHERE NOT EXISTS (SELECT 1 FROM sports WHERE code = 'alergare');

INSERT INTO sports (id, code, name)
SELECT gen_random_uuid(), 'multisport', 'Multisport'
WHERE NOT EXISTS (SELECT 1 FROM sports WHERE code = 'multisport');

-- Step 2: Add temporary column for sport_id
ALTER TABLE courses ADD COLUMN IF NOT EXISTS sport_id UUID;

-- Step 3: Migrate existing data - map sport codes to sport_id
UPDATE courses c
SET sport_id = s.id
FROM sports s
WHERE LOWER(c.sport) = LOWER(s.code)
AND c.sport_id IS NULL;

-- Step 4: Check for unmapped courses
SELECT 
    id, 
    name, 
    sport as old_sport_value
FROM courses 
WHERE sport_id IS NULL;

-- If there are unmapped courses, map them to a default sport or update manually
-- Example: Map all remaining to 'multisport'
UPDATE courses c
SET sport_id = (SELECT id FROM sports WHERE code = 'multisport' LIMIT 1)
WHERE c.sport_id IS NULL;

-- Step 5: Make sport_id NOT NULL
ALTER TABLE courses ALTER COLUMN sport_id SET NOT NULL;

-- Step 6: Add foreign key constraint
ALTER TABLE courses ADD CONSTRAINT IF NOT EXISTS fk_courses_sport
    FOREIGN KEY (sport_id) REFERENCES sports(id);

-- Step 7: Create index for performance
CREATE INDEX IF NOT EXISTS idx_courses_sport_id ON courses(sport_id);

-- Step 8: Drop the old sport string column (BACKUP YOUR DATA FIRST!)
-- ALTER TABLE courses DROP COLUMN sport;

-- Step 9: Rename sport_id to sport
-- ALTER TABLE courses RENAME COLUMN sport_id TO sport;

-- IMPORTANT: After running this script:
-- 1. Restart your backend application
-- 2. The filter by sport should now work correctly
-- 3. The course cards will display sport names from the database

