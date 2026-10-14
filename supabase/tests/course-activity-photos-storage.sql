\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END;
$$;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;

CREATE TABLE public.clubs (id UUID PRIMARY KEY, owner_user_id UUID);
CREATE TABLE public.courses (id UUID PRIMARY KEY, club_id UUID, coach_id UUID);
CREATE TABLE public.activities (id UUID PRIMARY KEY, club_id UUID, coach_id UUID);

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
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM public.clubs WHERE owner_user_id = auth.uid()
$$;

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

CREATE FUNCTION public.pot_administra_curs(p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = p_course_id
          AND (
              c.club_id IN (SELECT my_club_ids())
              OR c.coach_id = (SELECT auth.uid())
          )
    ) OR (SELECT get_my_role()) = 'ADMIN'
$$;

CREATE FUNCTION public.pot_administra_activitate(p_activity_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.activities a
        WHERE a.id = p_activity_id
          AND (
              a.club_id IN (SELECT my_club_ids())
              OR a.coach_id = (SELECT auth.uid())
          )
    ) OR (SELECT get_my_role()) = 'ADMIN'
$$;
GRANT EXECUTE ON FUNCTION public.get_my_role(), public.my_club_ids(), public.safe_uuid(TEXT),
    public.pot_administra_curs(UUID), public.pot_administra_activitate(UUID) TO anon, authenticated;

CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE storage.objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id TEXT NOT NULL,
    name TEXT NOT NULL
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated, anon;

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
GRANT EXECUTE ON FUNCTION storage.foldername(TEXT) TO anon, authenticated;

CREATE POLICY "course_photos_coach_insert" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'course-photos' AND public.get_my_role() IN ('COACH', 'ADMIN', 'CLUB'));
CREATE POLICY "course_photos_coach_update" ON storage.objects
    FOR UPDATE USING (bucket_id = 'course-photos' AND public.get_my_role() IN ('COACH', 'ADMIN', 'CLUB'));
CREATE POLICY "course_photos_coach_delete" ON storage.objects
    FOR DELETE USING (bucket_id = 'course-photos' AND public.get_my_role() IN ('COACH', 'ADMIN', 'CLUB'));
CREATE POLICY "activity_photos_insert" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'activity-photos' AND public.get_my_role() IN ('COACH', 'CLUB', 'ADMIN'));
CREATE POLICY "activity_photos_delete" ON storage.objects
    FOR DELETE USING (bucket_id = 'activity-photos' AND public.get_my_role() IN ('COACH', 'CLUB', 'ADMIN'));

\i /tmp/migrations/00090_course_activity_photos_owner_policies.sql

DO $$
BEGIN
    IF (SELECT count(*) FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND (coalesce(qual, '') || coalesce(with_check, '')) ~ '(course|activity)-photos') <> 7 THEN
        RAISE EXCEPTION 'Expected exactly the seven owner policies on course-photos and activity-photos';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND (coalesce(qual, '') || coalesce(with_check, '')) ~ '(course|activity)-photos'
          AND roles <> '{authenticated}') THEN
        RAISE EXCEPTION 'A photo policy still applies to anon';
    END IF;
END;
$$;

INSERT INTO public.clubs(id, owner_user_id) VALUES
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-00000000000a'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-00000000000b');
INSERT INTO public.courses(id, club_id, coach_id) VALUES
    ('c0000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NULL),
    ('c0000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', NULL),
    ('c0000000-0000-4000-8000-00000000000c', NULL, '00000000-0000-0000-0000-00000000000c');
INSERT INTO public.activities(id, club_id, coach_id) VALUES
    ('a0000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NULL),
    ('a0000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', NULL),
    ('a0000000-0000-4000-8000-00000000000c', NULL, '00000000-0000-0000-0000-00000000000c');

INSERT INTO storage.objects(bucket_id, name) VALUES
    ('course-photos', 'c0000000-0000-4000-8000-00000000000b/hero/11111111-1111-4111-8111-111111111111.jpg'),
    ('activity-photos', 'a0000000-0000-4000-8000-00000000000a/hero/22222222-2222-4222-8222-222222222222.jpg'),
    ('activity-photos', 'a0000000-0000-4000-8000-00000000000b/hero/33333333-3333-4333-8333-333333333333.jpg');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
SET LOCAL request.jwt.claim.role = 'CLUB';

INSERT INTO storage.objects(bucket_id, name) VALUES
    ('course-photos', 'c0000000-0000-4000-8000-00000000000a/hero/44444444-4444-4444-8444-444444444444.jpg'),
    ('activity-photos', 'a0000000-0000-4000-8000-00000000000a/hero/55555555-5555-4555-8555-555555555555.jpg');

DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT count(*) INTO v_count FROM storage.objects;
    IF v_count <> 3 THEN
        RAISE EXCEPTION 'Club owner must see exactly its own three photos, saw %', v_count;
    END IF;

    BEGIN
        INSERT INTO storage.objects(bucket_id, name)
        VALUES ('course-photos', 'c0000000-0000-4000-8000-00000000000b/hero/66666666-6666-4666-8666-666666666666.jpg');
        RAISE EXCEPTION 'A club uploaded into another club course';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    BEGIN
        INSERT INTO storage.objects(bucket_id, name)
        VALUES ('activity-photos', 'a0000000-0000-4000-8000-00000000000c/hero/66666666-6666-4666-8666-666666666666.jpg');
        RAISE EXCEPTION 'A club uploaded into a coach activity';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    BEGIN
        INSERT INTO storage.objects(bucket_id, name)
        VALUES ('course-photos', 'not-a-uuid/hero/66666666-6666-4666-8666-666666666666.jpg');
        RAISE EXCEPTION 'A club uploaded outside any course folder';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    UPDATE storage.objects SET name = name || '.x'
    WHERE name LIKE 'c0000000-0000-4000-8000-00000000000b/%';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'A club overwrote another club course photo';
    END IF;

    BEGIN
        UPDATE storage.objects
        SET name = 'c0000000-0000-4000-8000-00000000000b/hero/44444444-4444-4444-8444-444444444444.jpg'
        WHERE name = 'c0000000-0000-4000-8000-00000000000a/hero/44444444-4444-4444-8444-444444444444.jpg';
        RAISE EXCEPTION 'A club moved its photo into another club course';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    DELETE FROM storage.objects
    WHERE name LIKE 'c0000000-0000-4000-8000-00000000000b/%'
       OR name LIKE 'a0000000-0000-4000-8000-00000000000b/%';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'A club deleted another club photo';
    END IF;

    DELETE FROM storage.objects
    WHERE name = 'a0000000-0000-4000-8000-00000000000a/hero/22222222-2222-4222-8222-222222222222.jpg';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'A club could not delete its replaced activity photo';
    END IF;

    DELETE FROM storage.objects
    WHERE name = 'c0000000-0000-4000-8000-00000000000a/hero/44444444-4444-4444-8444-444444444444.jpg';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'A club could not delete its replaced course photo';
    END IF;
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SET LOCAL request.jwt.claim.role = 'COACH';
INSERT INTO storage.objects(bucket_id, name) VALUES
    ('course-photos', 'c0000000-0000-4000-8000-00000000000c/hero/77777777-7777-4777-8777-777777777777.jpg'),
    ('activity-photos', 'a0000000-0000-4000-8000-00000000000c/hero/88888888-8888-4888-8888-888888888888.jpg');
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT count(*) INTO v_count FROM storage.objects;
    IF v_count <> 2 THEN
        RAISE EXCEPTION 'Coach must see exactly its own two photos, saw %', v_count;
    END IF;
    BEGIN
        INSERT INTO storage.objects(bucket_id, name)
        VALUES ('course-photos', 'c0000000-0000-4000-8000-00000000000a/hero/99999999-9999-4999-8999-999999999999.jpg');
        RAISE EXCEPTION 'A coach uploaded into a club course';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    DELETE FROM storage.objects
    WHERE name = 'c0000000-0000-4000-8000-00000000000c/hero/77777777-7777-4777-8777-777777777777.jpg';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'A coach could not delete its replaced course photo';
    END IF;
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
SET LOCAL request.jwt.claim.role = 'COACH';
DO $$
DECLARE
    v_count INT;
BEGIN
    IF EXISTS (SELECT 1 FROM storage.objects) THEN
        RAISE EXCEPTION 'An unrelated coach can list photos';
    END IF;
    BEGIN
        INSERT INTO storage.objects(bucket_id, name)
        VALUES ('activity-photos', 'a0000000-0000-4000-8000-00000000000c/hero/99999999-9999-4999-8999-999999999999.jpg');
        RAISE EXCEPTION 'An unrelated coach uploaded into another coach activity';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    DELETE FROM storage.objects WHERE bucket_id IN ('course-photos', 'activity-photos');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'An unrelated coach deleted photos';
    END IF;
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
SET LOCAL request.jwt.claim.role = 'ADMIN';
INSERT INTO storage.objects(bucket_id, name) VALUES
    ('course-photos', 'c0000000-0000-4000-8000-00000000000b/hero/aaaaaaaa-0000-4000-8000-000000000001.jpg');
DO $$
DECLARE
    v_count INT;
BEGIN
    DELETE FROM storage.objects
    WHERE name IN (
        'c0000000-0000-4000-8000-00000000000b/hero/aaaaaaaa-0000-4000-8000-000000000001.jpg',
        'a0000000-0000-4000-8000-00000000000b/hero/33333333-3333-4333-8333-333333333333.jpg'
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 2 THEN
        RAISE EXCEPTION 'Admin lost access to course or activity photos';
    END IF;
END;
$$;

RESET ROLE;
SET LOCAL ROLE anon;
RESET request.jwt.claim.sub;
RESET request.jwt.claim.role;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM storage.objects) THEN
        RAISE EXCEPTION 'Anonymous visitors can list photos';
    END IF;
    BEGIN
        INSERT INTO storage.objects(bucket_id, name)
        VALUES ('course-photos', 'c0000000-0000-4000-8000-00000000000a/hero/bbbbbbbb-0000-4000-8000-000000000001.jpg');
        RAISE EXCEPTION 'Anonymous visitor uploaded a course photo';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;

RESET ROLE;
DO $$
BEGIN
    IF (SELECT count(*) FROM storage.objects) <> 3 THEN
        RAISE EXCEPTION 'Unexpected final object count %', (SELECT count(*) FROM storage.objects);
    END IF;
END;
$$;
ROLLBACK;
