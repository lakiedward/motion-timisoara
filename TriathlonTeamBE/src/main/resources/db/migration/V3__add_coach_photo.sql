-- Add photo fields to coach_profiles table
ALTER TABLE coach_profiles
    ADD COLUMN IF NOT EXISTS photo BYTEA;

ALTER TABLE coach_profiles
    ADD COLUMN IF NOT EXISTS photo_content_type VARCHAR(100);

-- Add comment for clarity
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'coach_profiles'
          AND column_name = 'photo'
    ) THEN
        EXECUTE format(
            'COMMENT ON COLUMN %I.%I IS %L',
            'coach_profiles',
            'photo',
            'Coach profile photo stored as binary data'
        );
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'coach_profiles'
          AND column_name = 'photo_content_type'
    ) THEN
        EXECUTE format(
            'COMMENT ON COLUMN %I.%I IS %L',
            'coach_profiles',
            'photo_content_type',
            'MIME type of the photo (e.g., image/jpeg, image/png)'
        );
    END IF;
END $$;

