\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END;
$$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')
$$;

CREATE FUNCTION public.my_club_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.club_id', true), '')::uuid
$$;

CREATE TABLE public.camps (
    id UUID PRIMARY KEY,
    coach_id UUID,
    title TEXT,
    slug TEXT
);

CREATE FUNCTION public.pot_administra_tabara(p_camp_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT TRUE
$$;
GRANT EXECUTE ON FUNCTION public.pot_administra_tabara(UUID) TO authenticated, anon;

CREATE FUNCTION public.safe_uuid(t TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
    RETURN t::uuid;
EXCEPTION WHEN others THEN
    RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.safe_uuid(TEXT) TO authenticated, anon;

CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE storage.buckets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    public BOOLEAN,
    file_size_limit BIGINT,
    allowed_mime_types TEXT[]
);
CREATE TABLE storage.objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id TEXT NOT NULL,
    name TEXT NOT NULL
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO authenticated, anon;
GRANT SELECT, INSERT, DELETE ON storage.objects TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON storage.buckets TO authenticated;

CREATE FUNCTION storage.foldername(name TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    _parts TEXT[];
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    RETURN _parts[1:array_length(_parts, 1) - 1];
END;
$$;

\i /tmp/migrations/00065_camp_rules_file.sql

CREATE TABLE public.courses (
    id UUID PRIMARY KEY,
    coach_id UUID,
    club_id UUID,
    name TEXT
);

CREATE TABLE public.activities (
    id UUID PRIMARY KEY,
    coach_id UUID,
    club_id UUID,
    name TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

\i /tmp/migrations/00066_course_activity_rules_file.sql

INSERT INTO public.courses (id, coach_id, club_id, name)
VALUES (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000301',
    'Curs'
);

INSERT INTO public.activities (id, coach_id, club_id, name)
VALUES (
    '00000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000301',
    'Activitate'
);

UPDATE public.courses
SET rules_file_storage_path = '00000000-0000-0000-0000-000000000011/aaaaaaa0-aaaa-4aaa-8aaa-aaaaaaaaaaa1.pdf',
    rules_file_name = 'regulament.pdf',
    rules_file_content_type = 'application/pdf',
    rules_file_size_bytes = 1200
WHERE id = '00000000-0000-0000-0000-000000000011';

UPDATE public.activities
SET rules_file_storage_path = '00000000-0000-0000-0000-000000000021/aaaaaaa0-aaaa-4aaa-8aaa-aaaaaaaaaaa1.pdf',
    rules_file_name = 'regulament.pdf',
    rules_file_content_type = 'application/pdf',
    rules_file_size_bytes = 800
WHERE id = '00000000-0000-0000-0000-000000000021';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM storage.buckets
        WHERE id = 'course-rules' AND public IS TRUE AND file_size_limit = 10485760
    ) THEN
        RAISE EXCEPTION 'course-rules bucket is missing public 10 MB limits';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM storage.buckets
        WHERE id = 'activity-rules' AND public IS TRUE AND file_size_limit = 10485760
    ) THEN
        RAISE EXCEPTION 'activity-rules bucket is missing public 10 MB limits';
    END IF;
END;
$$;

DO $$
BEGIN
    BEGIN
        UPDATE public.courses
        SET rules_file_content_type = 'video/mp4'
        WHERE id = '00000000-0000-0000-0000-000000000011';
        RAISE EXCEPTION 'Video MIME must be rejected on a course';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.activities
        SET rules_file_size_bytes = 10485761
        WHERE id = '00000000-0000-0000-0000-000000000021';
        RAISE EXCEPTION 'Oversize file must be rejected on an activity';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.courses
        SET rules_file_name = NULL
        WHERE id = '00000000-0000-0000-0000-000000000011';
        RAISE EXCEPTION 'Partial course file metadata must be rejected';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.activities
        SET rules_file_storage_path = '00000000-0000-0000-0000-000000000022/x.pdf'
        WHERE id = '00000000-0000-0000-0000-000000000021';
        RAISE EXCEPTION 'Path for another activity must be rejected';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END;
$$;

SET LOCAL request.jwt.claim.role = 'COACH';
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000101';
UPDATE public.activities
SET name = 'Activitate actualizată'
WHERE id = '00000000-0000-0000-0000-000000000021';

SET LOCAL request.jwt.claim.role = 'CLUB';
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000201';
SET LOCAL request.jwt.claim.club_id = '00000000-0000-0000-0000-000000000301';
UPDATE public.activities
SET rules_file_name = 'regulament-club.pdf'
WHERE id = '00000000-0000-0000-0000-000000000021';

DO $$
BEGIN
    BEGIN
        UPDATE public.activities
        SET name = 'Schimbat de club'
        WHERE id = '00000000-0000-0000-0000-000000000021';
        RAISE EXCEPTION 'Club must not change activity fields other than the rules file';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'COACH';
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000101';
INSERT INTO storage.objects (bucket_id, name)
VALUES (
    'course-rules',
    '00000000-0000-0000-0000-000000000011/bbbbbbb0-bbbb-4bbb-8bbb-bbbbbbbbbbb1.pdf'
);
INSERT INTO storage.objects (bucket_id, name)
VALUES (
    'activity-rules',
    '00000000-0000-0000-0000-000000000021/bbbbbbb0-bbbb-4bbb-8bbb-bbbbbbbbbbb1.pdf'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000202';
SET LOCAL request.jwt.claim.role = 'COACH';
SET LOCAL request.jwt.claim.club_id = '';
DO $$
BEGIN
    BEGIN
        INSERT INTO storage.objects (bucket_id, name)
        VALUES (
            'course-rules',
            '00000000-0000-0000-0000-000000000011/ccccccc0-cccc-4ccc-8ccc-ccccccccccc1.pdf'
        );
        RAISE EXCEPTION 'Foreign organizer must not upload another course rules file';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        INSERT INTO storage.objects (bucket_id, name)
        VALUES (
            'activity-rules',
            '00000000-0000-0000-0000-000000000021/ccccccc0-cccc-4ccc-8ccc-ccccccccccc1.pdf'
        );
        RAISE EXCEPTION 'Foreign organizer must not upload another activity rules file';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;

RESET ROLE;
ROLLBACK;
