-- QUICK FIX pentru Railway Production Database
-- Copy-paste acest SQL direct în psql

-- 1. Adaugă sporturile necesare
INSERT INTO sports (id, code, name) VALUES (gen_random_uuid(), 'inot', 'Înot') ON CONFLICT (code) DO NOTHING;
INSERT INTO sports (id, code, name) VALUES (gen_random_uuid(), 'swim', 'Înot') ON CONFLICT (code) DO NOTHING;
INSERT INTO sports (id, code, name) VALUES (gen_random_uuid(), 'bike', 'Ciclism') ON CONFLICT (code) DO NOTHING;
INSERT INTO sports (id, code, name) VALUES (gen_random_uuid(), 'run', 'Alergare') ON CONFLICT (code) DO NOTHING;
INSERT INTO sports (id, code, name) VALUES (gen_random_uuid(), 'ciclism', 'Ciclism') ON CONFLICT (code) DO NOTHING;
INSERT INTO sports (id, code, name) VALUES (gen_random_uuid(), 'alergare', 'Alergare') ON CONFLICT (code) DO NOTHING;
INSERT INTO sports (id, code, name) VALUES (gen_random_uuid(), 'multisport', 'Multisport') ON CONFLICT (code) DO NOTHING;

-- 2. Verifică ce cursuri avem
SELECT id, name, sport FROM courses;

-- 3. Adaugă coloana sport_id
ALTER TABLE courses ADD COLUMN IF NOT EXISTS sport_id UUID;

-- 4. Mapează datele existente
UPDATE courses c
SET sport_id = s.id
FROM sports s
WHERE LOWER(c.sport) = LOWER(s.code)
AND c.sport_id IS NULL;

-- 5. Verifică dacă mai sunt cursuri nemapate
SELECT id, name, sport FROM courses WHERE sport_id IS NULL;

-- 6. Mapează restul la multisport
UPDATE courses c
SET sport_id = (SELECT id FROM sports WHERE code = 'multisport' LIMIT 1)
WHERE c.sport_id IS NULL;

-- 7. Setează NOT NULL
ALTER TABLE courses ALTER COLUMN sport_id SET NOT NULL;

-- 8. Adaugă foreign key
ALTER TABLE courses DROP CONSTRAINT IF EXISTS fk_courses_sport;
ALTER TABLE courses ADD CONSTRAINT fk_courses_sport FOREIGN KEY (sport_id) REFERENCES sports(id);

-- 9. Crează index
DROP INDEX IF EXISTS idx_courses_sport_id;
CREATE INDEX idx_courses_sport_id ON courses(sport_id);

-- 10. Backup vechea coloană
ALTER TABLE courses RENAME COLUMN sport TO sport_old_backup;

-- 11. Redenumește sport_id -> sport
ALTER TABLE courses RENAME COLUMN sport_id TO sport;

-- 12. Verifică rezultatul
SELECT c.id, c.name, s.code, s.name as sport_name 
FROM courses c 
JOIN sports s ON c.sport = s.id;

-- GATA! Acum restart backend-ul din Railway

