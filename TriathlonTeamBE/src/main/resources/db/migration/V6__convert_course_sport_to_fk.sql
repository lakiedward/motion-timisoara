-- Migration to convert course.sport from String to foreign key relationship with sports table
DO $$
DECLARE
    sport_data_type TEXT;
BEGIN
    SELECT data_type INTO sport_data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'courses'
      AND column_name = 'sport';

    -- If the column no longer exists or is already a UUID, the migration has run
    IF sport_data_type IS NULL OR sport_data_type = 'uuid' THEN
        RETURN;
    END IF;

    -- Step 1: Add new column for the sport_id foreign key if missing
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'courses'
          AND column_name = 'sport_id'
    ) THEN
        EXECUTE 'ALTER TABLE courses ADD COLUMN sport_id UUID';
    END IF;

    -- Step 2: Migrate existing data - map sport codes to sport_id
    UPDATE courses c
    SET sport_id = s.id
    FROM sports s
    WHERE LOWER(c.sport) = LOWER(s.code);

    -- Step 3: For any courses that don't have a match, try to find a sport by partial name match
    UPDATE courses c
    SET sport_id = s.id
    FROM sports s
    WHERE c.sport_id IS NULL
      AND (
        LOWER(s.name) LIKE '%' || LOWER(c.sport) || '%'
        OR LOWER(c.sport) LIKE '%' || LOWER(s.name) || '%'
      );

    -- Step 4: If there are still NULL values, set them to a default sport (first available)
    IF EXISTS (SELECT 1 FROM sports) THEN
        UPDATE courses c
        SET sport_id = (
            SELECT id FROM sports ORDER BY code LIMIT 1
        )
        WHERE c.sport_id IS NULL;
    END IF;

    -- Step 5: Make sport_id NOT NULL once fully populated
    IF NOT EXISTS (
        SELECT 1 FROM courses WHERE sport_id IS NULL
    ) THEN
        EXECUTE 'ALTER TABLE courses ALTER COLUMN sport_id SET NOT NULL';
    END IF;

    -- Step 6: Add foreign key constraint if missing
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_courses_sport'
          AND conrelid = 'courses'::regclass
    ) THEN
        EXECUTE 'ALTER TABLE courses ADD CONSTRAINT fk_courses_sport FOREIGN KEY (sport_id) REFERENCES sports(id)';
    END IF;

    -- Step 7: Create index for performance
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_courses_sport_id ON courses(sport_id)';

    -- Step 8 & 9: Drop the old sport column and rename sport_id to sport
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'courses'
          AND column_name = 'sport_id'
    ) THEN
        EXECUTE 'ALTER TABLE courses DROP COLUMN IF EXISTS sport';
        EXECUTE 'ALTER TABLE courses RENAME COLUMN sport_id TO sport';
    END IF;
END $$;

