-- URGENT: Fix production database for sport relationship
-- Run this script on your Railway production database NOW

-- Step 1: Ensure sports table has the needed sports
INSERT INTO sports (id, code, name)
VALUES (gen_random_uuid(), 'inot', 'Înot')
ON CONFLICT (code) DO NOTHING;

INSERT INTO sports (id, code, name)
VALUES (gen_random_uuid(), 'swim', 'Înot')
ON CONFLICT (code) DO NOTHING;

INSERT INTO sports (id, code, name)
VALUES (gen_random_uuid(), 'bike', 'Ciclism')
ON CONFLICT (code) DO NOTHING;

INSERT INTO sports (id, code, name)
VALUES (gen_random_uuid(), 'run', 'Alergare')
ON CONFLICT (code) DO NOTHING;

INSERT INTO sports (id, code, name)
VALUES (gen_random_uuid(), 'multisport', 'Multisport')
ON CONFLICT (code) DO NOTHING;

-- Step 2: Check current course data
SELECT id, name, sport FROM courses LIMIT 5;

-- Step 3: Add sport_id column
ALTER TABLE courses ADD COLUMN IF NOT EXISTS sport_id UUID;

-- Step 4: Migrate data - map sport string to sport_id
UPDATE courses c
SET sport_id = s.id
FROM sports s
WHERE LOWER(c.sport) = LOWER(s.code)
AND c.sport_id IS NULL;

-- Step 5: Check if any courses still have NULL sport_id
SELECT id, name, sport FROM courses WHERE sport_id IS NULL;

-- Step 6: For any unmapped courses, use a default
UPDATE courses c
SET sport_id = (SELECT id FROM sports WHERE code = 'multisport' LIMIT 1)
WHERE c.sport_id IS NULL;

-- Step 7: Make sport_id NOT NULL
ALTER TABLE courses ALTER COLUMN sport_id SET NOT NULL;

-- Step 8: Add foreign key
ALTER TABLE courses ADD CONSTRAINT IF NOT EXISTS fk_courses_sport
    FOREIGN KEY (sport_id) REFERENCES sports(id);

-- Step 9: Create index
CREATE INDEX IF NOT EXISTS idx_courses_sport_id ON courses(sport_id);

-- Step 10: Backup old column data (optional but recommended)
ALTER TABLE courses RENAME COLUMN sport TO sport_old_backup;

-- Step 11: Rename sport_id to sport
ALTER TABLE courses RENAME COLUMN sport_id TO sport;

-- DONE! Now restart your backend application

