-- Add hero photo fields to courses table
ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS hero_photo BYTEA;

ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS hero_photo_content_type VARCHAR(100);

-- Add comments for clarity
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'courses'
          AND column_name = 'hero_photo'
    ) THEN
        EXECUTE format(
            'COMMENT ON COLUMN %I.%I IS %L',
            'courses',
            'hero_photo',
            'Course hero photo stored as binary data'
        );
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'courses'
          AND column_name = 'hero_photo_content_type'
    ) THEN
        EXECUTE format(
            'COMMENT ON COLUMN %I.%I IS %L',
            'courses',
            'hero_photo_content_type',
            'MIME type of the hero photo (e.g., image/jpeg, image/png)'
        );
    END IF;
END $$;

-- Create course_photos table for gallery
CREATE TABLE IF NOT EXISTS course_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL,
    photo BYTEA NOT NULL,
    photo_content_type VARCHAR(100) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_course_photos_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_course_photos_course_id ON course_photos(course_id);
CREATE INDEX IF NOT EXISTS idx_course_photos_display_order ON course_photos(course_id, display_order);

-- Add comments
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename = 'course_photos'
    ) THEN
        EXECUTE format('COMMENT ON TABLE %I IS %L', 'course_photos', 'Gallery photos for courses');
        EXECUTE format(
            'COMMENT ON COLUMN %I.%I IS %L',
            'course_photos',
            'photo',
            'Photo stored as binary data'
        );
        EXECUTE format(
            'COMMENT ON COLUMN %I.%I IS %L',
            'course_photos',
            'photo_content_type',
            'MIME type of the photo'
        );
        EXECUTE format(
            'COMMENT ON COLUMN %I.%I IS %L',
            'course_photos',
            'display_order',
            'Order in which photos should be displayed'
        );
    END IF;
END $$;

