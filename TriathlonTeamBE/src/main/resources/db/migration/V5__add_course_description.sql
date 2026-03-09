-- Add description field to courses table
ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS description TEXT;

-- Add comment for clarity
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'courses'
          AND column_name = 'description'
    ) THEN
        EXECUTE format(
            'COMMENT ON COLUMN %I.%I IS %L',
            'courses',
            'description',
            'Course description for public display'
        );
    END IF;
END $$;

