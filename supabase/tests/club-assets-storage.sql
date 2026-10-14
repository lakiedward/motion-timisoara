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

CREATE TABLE public.clubs (
    id UUID PRIMARY KEY,
    owner_user_id UUID
);

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
GRANT EXECUTE ON FUNCTION public.get_my_role(), public.my_club_ids(), public.safe_uuid(TEXT) TO anon, authenticated;

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

CREATE POLICY "club_assets_owner_insert" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'club-assets' AND public.get_my_role() IN ('CLUB', 'ADMIN'));
CREATE POLICY "club_assets_owner_update" ON storage.objects
    FOR UPDATE USING (bucket_id = 'club-assets' AND public.get_my_role() IN ('CLUB', 'ADMIN'));
CREATE POLICY "club_assets_owner_delete" ON storage.objects
    FOR DELETE USING (bucket_id = 'club-assets' AND public.get_my_role() IN ('CLUB', 'ADMIN'));

\i /tmp/migrations/00089_club_assets_owner_policies.sql

INSERT INTO public.clubs(id, owner_user_id) VALUES
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-00000000000a'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-00000000000b');

INSERT INTO storage.objects(bucket_id, name) VALUES
    ('club-assets', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/logo/11111111-1111-4111-8111-111111111111.jpg');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
SET LOCAL request.jwt.claim.role = 'CLUB';

INSERT INTO storage.objects(bucket_id, name) VALUES
    ('club-assets', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo/22222222-2222-4222-8222-222222222222.jpg'),
    ('club-assets', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/hero/33333333-3333-4333-8333-333333333333.jpg');

DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT count(*) INTO v_count FROM storage.objects WHERE bucket_id = 'club-assets';
    IF v_count <> 2 THEN
        RAISE EXCEPTION 'Club owner must see exactly its own two files, saw %', v_count;
    END IF;

    BEGIN
        INSERT INTO storage.objects(bucket_id, name)
        VALUES ('club-assets', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/logo/44444444-4444-4444-8444-444444444444.jpg');
        RAISE EXCEPTION 'A club uploaded into another club folder';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    BEGIN
        INSERT INTO storage.objects(bucket_id, name)
        VALUES ('club-assets', 'not-a-uuid/logo/55555555-5555-4555-8555-555555555555.jpg');
        RAISE EXCEPTION 'A club uploaded outside any club folder';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    UPDATE storage.objects SET name = name || '.x'
    WHERE name LIKE 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/%';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'A club overwrote another club file';
    END IF;

    BEGIN
        UPDATE storage.objects
        SET name = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/logo/22222222-2222-4222-8222-222222222222.jpg'
        WHERE name = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo/22222222-2222-4222-8222-222222222222.jpg';
        RAISE EXCEPTION 'A club moved its file into another club folder';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    DELETE FROM storage.objects WHERE name LIKE 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/%';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'A club deleted another club file';
    END IF;

    DELETE FROM storage.objects
    WHERE name = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo/22222222-2222-4222-8222-222222222222.jpg';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'A club could not delete its replaced logo';
    END IF;
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SET LOCAL request.jwt.claim.role = 'COACH';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM storage.objects) THEN
        RAISE EXCEPTION 'A coach can list club files';
    END IF;
    BEGIN
        INSERT INTO storage.objects(bucket_id, name)
        VALUES ('club-assets', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo/66666666-6666-4666-8666-666666666666.jpg');
        RAISE EXCEPTION 'A coach uploaded a club file';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
SET LOCAL request.jwt.claim.role = 'ADMIN';
INSERT INTO storage.objects(bucket_id, name) VALUES
    ('club-assets', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/hero/77777777-7777-4777-8777-777777777777.jpg');
DO $$
DECLARE
    v_count INT;
BEGIN
    DELETE FROM storage.objects
    WHERE name = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/hero/77777777-7777-4777-8777-777777777777.jpg';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Admin lost access to club files';
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
        RAISE EXCEPTION 'Anonymous visitors can list club files';
    END IF;
    BEGIN
        INSERT INTO storage.objects(bucket_id, name)
        VALUES ('club-assets', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo/88888888-8888-4888-8888-888888888888.jpg');
        RAISE EXCEPTION 'Anonymous visitor uploaded a club file';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;

RESET ROLE;
DO $$
BEGIN
    IF (SELECT count(*) FROM storage.objects) <> 2 THEN
        RAISE EXCEPTION 'Unexpected final object count';
    END IF;
END;
$$;
ROLLBACK;
