-- Fix activities.sport column: convert from VARCHAR (sports.code) to UUID (sports.id)
DO $$
DECLARE
    sport_data_type TEXT;
BEGIN
    SELECT data_type INTO sport_data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activities'
      AND column_name = 'sport';

    -- If the column is already UUID, nothing to do
    IF sport_data_type = 'uuid' THEN
        RETURN;
    END IF;

    -- Step 1: Add new column for sport_id
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'activities'
          AND column_name = 'sport_id'
    ) THEN
        EXECUTE 'ALTER TABLE activities ADD COLUMN sport_id UUID';
    END IF;

    -- Step 2: Migrate existing data - map sport codes to sport_id
    UPDATE activities a
    SET sport_id = s.id
    FROM sports s
    WHERE LOWER(a.sport) = LOWER(s.code);

    -- Step 3: For any activities that don't have a match, try partial name match
    UPDATE activities a
    SET sport_id = s.id
    FROM sports s
    WHERE a.sport_id IS NULL
      AND (
        LOWER(s.name) LIKE '%' || LOWER(a.sport) || '%'
        OR LOWER(a.sport) LIKE '%' || LOWER(s.name) || '%'
      );

    -- Step 4: If still NULL, set to first available sport
    IF EXISTS (SELECT 1 FROM sports) THEN
        UPDATE activities a
        SET sport_id = (
            SELECT id FROM sports ORDER BY code LIMIT 1
        )
        WHERE a.sport_id IS NULL;
    END IF;

    -- Step 5: Make sport_id NOT NULL
    IF NOT EXISTS (
        SELECT 1 FROM activities WHERE sport_id IS NULL
    ) THEN
        EXECUTE 'ALTER TABLE activities ALTER COLUMN sport_id SET NOT NULL';
    END IF;

    -- Step 6: Add foreign key constraint
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_activities_sport'
          AND conrelid = 'activities'::regclass
    ) THEN
        EXECUTE 'ALTER TABLE activities ADD CONSTRAINT fk_activities_sport FOREIGN KEY (sport_id) REFERENCES sports(id)';
    END IF;

    -- Step 7: Drop old index and create new one
    EXECUTE 'DROP INDEX IF EXISTS idx_activities_sport';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_activities_sport_id ON activities(sport_id)';

    -- Step 8: Drop the old sport column and rename sport_id to sport
    EXECUTE 'ALTER TABLE activities DROP COLUMN IF EXISTS sport';
    EXECUTE 'ALTER TABLE activities RENAME COLUMN sport_id TO sport';

    -- Rename index to match column name
    EXECUTE 'DROP INDEX IF EXISTS idx_activities_sport_id';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_activities_sport ON activities(sport)';
END $$;
