\set ON_ERROR_STOP on
\set migration `cat /tmp/migrations/00143_announcement_media_limits.sql`
BEGIN;
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END;
$$;

CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE storage.buckets (
    id TEXT PRIMARY KEY,
    public BOOLEAN NOT NULL DEFAULT false,
    file_size_limit BIGINT,
    allowed_mime_types TEXT[]
);
CREATE TABLE storage.objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id TEXT NOT NULL,
    name TEXT NOT NULL
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets(id, public, file_size_limit, allowed_mime_types) VALUES
    ('announcement-media', false, NULL, NULL),
    ('child-photos', false, NULL, NULL),
    ('course-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

CREATE FUNCTION pg_temp.expect_refused(p_sql TEXT, p_fragment TEXT, p_message TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN raise_exception THEN
        IF position(p_fragment IN SQLERRM) = 0 THEN
            RAISE EXCEPTION '%: unexpected error %', p_message, SQLERRM;
        END IF;
        RETURN;
    END;
    RAISE EXCEPTION '%', p_message;
END;
$$;

SELECT pg_temp.expect_refused(:'migration', 'Politici lipsă',
    'The migration ran although the 00141 write policies were missing');

CREATE POLICY "announcement_media_owner_insert" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'announcement-media');
CREATE POLICY "announcement_media_owner_delete" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'announcement-media');
CREATE POLICY "announcement_media_read" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'announcement-media');

UPDATE storage.buckets SET public = true WHERE id = 'announcement-media';
SELECT pg_temp.expect_refused(:'migration', 'a devenit public',
    'The migration ran on a public announcement bucket');
UPDATE storage.buckets SET public = false WHERE id = 'announcement-media';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'announcement-media'
               AND (file_size_limit IS NOT NULL OR allowed_mime_types IS NOT NULL)) THEN
        RAISE EXCEPTION 'A refused run left limits behind';
    END IF;
END;
$$;

\i /tmp/migrations/00143_announcement_media_limits.sql

DO $$
DECLARE
    v_bucket storage.buckets%ROWTYPE;
BEGIN
    SELECT * INTO v_bucket FROM storage.buckets WHERE id = 'announcement-media';
    IF v_bucket.public THEN
        RAISE EXCEPTION 'The announcement bucket became public';
    END IF;
    IF v_bucket.file_size_limit IS DISTINCT FROM 52428800 THEN
        RAISE EXCEPTION 'Expected a 50 MiB limit, found %', v_bucket.file_size_limit;
    END IF;
    IF v_bucket.allowed_mime_types IS DISTINCT FROM ARRAY[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'video/mp4', 'video/quicktime', 'video/webm'
    ] THEN
        RAISE EXCEPTION 'Unexpected types %', v_bucket.allowed_mime_types;
    END IF;
    IF 'image/svg+xml' = ANY (v_bucket.allowed_mime_types)
        OR 'text/html' = ANY (v_bucket.allowed_mime_types) THEN
        RAISE EXCEPTION 'SVG or HTML is allowed in announcements';
    END IF;
    IF (SELECT file_size_limit FROM storage.buckets WHERE id = 'child-photos') IS NOT NULL
        OR (SELECT file_size_limit FROM storage.buckets WHERE id = 'course-photos') <> 10485760 THEN
        RAISE EXCEPTION 'Other buckets were changed';
    END IF;
END;
$$;

SELECT pg_temp.expect_refused(:'migration', 'are deja limite',
    'The migration overwrote limits that were already set');

DELETE FROM storage.buckets WHERE id = 'announcement-media';
SELECT pg_temp.expect_refused(:'migration', 'lipsește',
    'The migration ran without the announcement bucket');

ROLLBACK;
\echo 'announcement-media-limits: OK'
