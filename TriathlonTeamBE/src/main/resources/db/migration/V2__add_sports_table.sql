-- Create sports table
CREATE TABLE IF NOT EXISTS sports (
    id UUID PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL
);

-- Create coach_sports junction table
CREATE TABLE IF NOT EXISTS coach_sports (
    coach_profile_id UUID NOT NULL,
    sport_id UUID NOT NULL,
    PRIMARY KEY (coach_profile_id, sport_id),
    CONSTRAINT fk_coach_sports_coach_profile FOREIGN KEY (coach_profile_id) REFERENCES coach_profiles (id) ON DELETE CASCADE,
    CONSTRAINT fk_coach_sports_sport FOREIGN KEY (sport_id) REFERENCES sports (id) ON DELETE CASCADE
);

-- Insert initial sports
INSERT INTO sports (id, code, name)
VALUES
    (gen_random_uuid(), 'swim', 'Înot'),
    (gen_random_uuid(), 'bike', 'Cycling'),
    (gen_random_uuid(), 'run', 'Alergare')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name;

-- Migrate existing data from coach_profiles.sports to coach_sports
-- This handles comma-separated values in the old sports field
DO $$
DECLARE
    profile_record RECORD;
    sport_record RECORD;
    sport_code TEXT;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'coach_profiles'
          AND column_name = 'sports'
    ) THEN
        FOR profile_record IN SELECT id, sports FROM coach_profiles WHERE sports IS NOT NULL AND sports != ''
        LOOP
            -- Split the sports string by comma and trim whitespace
            FOR sport_code IN SELECT TRIM(unnest(string_to_array(profile_record.sports, ',')))
            LOOP
                -- Find the sport by code (case insensitive match)
                FOR sport_record IN
                    SELECT id FROM sports
                    WHERE LOWER(code) = LOWER(sport_code)
                       OR LOWER(name) LIKE '%' || LOWER(sport_code) || '%'
                    LIMIT 1
                LOOP
                    -- Insert into junction table if not exists
                    INSERT INTO coach_sports (coach_profile_id, sport_id)
                    VALUES (profile_record.id, sport_record.id)
                    ON CONFLICT DO NOTHING;
                END LOOP;
            END LOOP;
        END LOOP;
    END IF;
END $$;

-- Drop the old sports column from coach_profiles
ALTER TABLE coach_profiles DROP COLUMN IF EXISTS sports;

