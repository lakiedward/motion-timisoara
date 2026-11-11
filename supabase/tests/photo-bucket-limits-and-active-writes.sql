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

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY,
    role TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ
);
CREATE TABLE public.clubs (id UUID PRIMARY KEY, owner_user_id UUID);
CREATE TABLE public.courses (id UUID PRIMARY KEY, coach_id UUID);
CREATE TABLE public.course_announcements (id UUID PRIMARY KEY, course_id UUID);
CREATE TABLE public.club_announcements (id UUID PRIMARY KEY, club_id UUID);
CREATE TABLE public.competitions (id UUID PRIMARY KEY, coach_id UUID);
CREATE TABLE public.competition_routes (
    id UUID PRIMARY KEY,
    competition_id UUID,
    name TEXT,
    gpx_storage_path TEXT
);
CREATE TABLE public.competition_registrations (id UUID PRIMARY KEY, gpx_storage_path_snapshot TEXT);

CREATE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles
    WHERE id = auth.uid() AND enabled AND deleted_at IS NULL
$$;

CREATE FUNCTION public.my_club_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT c.id FROM public.clubs c
    WHERE c.owner_user_id = auth.uid() AND public.get_my_role() IS NOT NULL
$$;

CREATE FUNCTION public.pot_administra_concurs(p_competition_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.get_my_role() IS NOT NULL AND (
        EXISTS (SELECT 1 FROM public.competitions c WHERE c.id = p_competition_id AND c.coach_id = auth.uid())
        OR public.get_my_role() = 'ADMIN'
    )
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
GRANT EXECUTE ON FUNCTION public.get_my_role(), public.my_club_ids(), public.pot_administra_concurs(UUID), public.safe_uuid(TEXT) TO anon, authenticated;
GRANT SELECT ON public.courses, public.course_announcements, public.club_announcements,
    public.competition_routes, public.competition_registrations TO authenticated;

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

INSERT INTO storage.buckets(id, public, file_size_limit, allowed_mime_types) VALUES
    ('activity-photos', true, NULL, NULL),
    ('camp-photos', true, NULL, NULL),
    ('club-assets', true, NULL, NULL),
    ('coach-photos', true, NULL, NULL),
    ('competition-photos', true, NULL, NULL),
    ('course-photos', true, NULL, NULL),
    ('sport-photos', true, NULL, NULL),
    ('announcement-media', false, NULL, NULL),
    ('child-photos', false, NULL, NULL),
    ('course-rules', true, 10485760, ARRAY['application/pdf']),
    ('competition-routes', true, 12582912, ARRAY['application/gpx+xml']);

CREATE POLICY "coach_photos_admin_all" ON storage.objects
    FOR ALL USING (bucket_id = 'coach-photos' AND public.get_my_role() = 'ADMIN');
CREATE POLICY "coach_photos_owner_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'coach-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "coach_photos_owner_insert" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'coach-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "coach_photos_owner_update" ON storage.objects
    FOR UPDATE USING (bucket_id = 'coach-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "coach_photos_owner_delete" ON storage.objects
    FOR DELETE USING (bucket_id = 'coach-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "child_photos_admin_all" ON storage.objects
    FOR ALL USING (bucket_id = 'child-photos' AND public.get_my_role() = 'ADMIN');
CREATE POLICY "child_photos_parent_all" ON storage.objects
    FOR ALL USING (bucket_id = 'child-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "announcement_media_owner_insert" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'announcement-media');
CREATE POLICY "announcement_media_owner_delete" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'announcement-media');
CREATE POLICY "announcement_media_read" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'announcement-media');
CREATE POLICY "competition_routes_storage_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'competition-routes' AND public.pot_administra_concurs(public.safe_uuid((storage.foldername(name))[1])));
CREATE POLICY "competition_routes_storage_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'competition-routes'
        AND public.pot_administra_concurs(public.safe_uuid((storage.foldername(name))[1]))
        AND NOT EXISTS (SELECT 1 FROM public.competition_routes route WHERE route.gpx_storage_path = route.name)
    );

\i /tmp/migrations/00141_photo_bucket_limits_and_active_writes.sql

DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT count(*) INTO v_count FROM storage.buckets
    WHERE id IN ('activity-photos', 'camp-photos', 'club-assets', 'coach-photos',
                 'competition-photos', 'course-photos', 'sport-photos')
      AND file_size_limit = 10485760
      AND allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    IF v_count <> 7 THEN
        RAISE EXCEPTION 'Expected limits on 7 photo buckets, found %', v_count;
    END IF;
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id IN ('announcement-media', 'child-photos') AND file_size_limit IS NOT NULL) THEN
        RAISE EXCEPTION 'Non-photo buckets were changed';
    END IF;
    IF (SELECT file_size_limit FROM storage.buckets WHERE id = 'competition-routes') <> 12582912
        OR (SELECT allowed_mime_types FROM storage.buckets WHERE id = 'course-rules') <> ARRAY['application/pdf'] THEN
        RAISE EXCEPTION 'Existing rules/GPX limits were overwritten';
    END IF;
END;
$$;

INSERT INTO public.profiles(id, role, enabled, deleted_at) VALUES
    ('00000000-0000-0000-0000-00000000c0ac', 'COACH', true, NULL),
    ('00000000-0000-0000-0000-00000000dc0a', 'COACH', false, NULL),
    ('00000000-0000-0000-0000-00000000aa01', 'PARENT', true, NULL),
    ('00000000-0000-0000-0000-00000000da01', 'PARENT', false, NULL),
    ('00000000-0000-0000-0000-00000000de01', 'PARENT', true, now()),
    ('00000000-0000-0000-0000-0000000c1b00', 'CLUB', true, NULL),
    ('00000000-0000-0000-0000-0000000dc1b0', 'CLUB', false, NULL),
    ('00000000-0000-0000-0000-0000000000ad', 'ADMIN', true, NULL);

INSERT INTO public.clubs(id, owner_user_id) VALUES
    ('c1b00000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000c1b00'),
    ('c1b00000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-0000000dc1b0');
INSERT INTO public.courses(id, coach_id) VALUES
    ('c0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-00000000c0ac'),
    ('c0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-00000000dc0a');
INSERT INTO public.course_announcements(id, course_id) VALUES
    ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001'),
    ('a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002');
INSERT INTO public.club_announcements(id, club_id) VALUES
    ('b0000000-0000-4000-8000-000000000001', 'c1b00000-0000-4000-8000-000000000001'),
    ('b0000000-0000-4000-8000-000000000002', 'c1b00000-0000-4000-8000-000000000002');
INSERT INTO public.competitions(id, coach_id) VALUES
    ('e0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-00000000c0ac');
INSERT INTO public.competition_routes(id, competition_id, name, gpx_storage_path) VALUES
    ('f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Traseu 5 km',
     'e0000000-0000-4000-8000-000000000001/routes/f0000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.gpx');
INSERT INTO public.competition_registrations(id, gpx_storage_path_snapshot) VALUES
    ('d0000000-0000-4000-8000-000000000001',
     'e0000000-0000-4000-8000-000000000001/routes/f0000000-0000-4000-8000-000000000001/22222222-2222-4222-8222-222222222222.gpx');

INSERT INTO storage.objects(bucket_id, name) VALUES
    ('coach-photos', '00000000-0000-0000-0000-00000000dc0a/old.jpg'),
    ('child-photos', '00000000-0000-0000-0000-00000000de01/child/old.jpg'),
    ('child-photos', '00000000-0000-0000-0000-00000000aa01/child/kept.jpg'),
    ('competition-routes', 'e0000000-0000-4000-8000-000000000001/routes/f0000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.gpx'),
    ('competition-routes', 'e0000000-0000-4000-8000-000000000001/routes/f0000000-0000-4000-8000-000000000001/22222222-2222-4222-8222-222222222222.gpx'),
    ('competition-routes', 'e0000000-0000-4000-8000-000000000001/routes/f0000000-0000-4000-8000-000000000001/33333333-3333-4333-8333-333333333333.gpx');

CREATE FUNCTION pg_temp.expect_refused(p_sql TEXT, p_message TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN insufficient_privilege THEN
        RETURN;
    END;
    RAISE EXCEPTION '%', p_message;
END;
$$;
GRANT EXECUTE ON FUNCTION pg_temp.expect_refused(TEXT, TEXT) TO authenticated;

SET LOCAL ROLE authenticated;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000c0ac';
INSERT INTO storage.objects(bucket_id, name) VALUES
    ('coach-photos', '00000000-0000-0000-0000-00000000c0ac/new.jpg'),
    ('announcement-media', 'a0000000-0000-4000-8000-000000000001/clip.mp4');
SELECT pg_temp.expect_refused(
    $q$INSERT INTO storage.objects(bucket_id, name) VALUES ('coach-photos', '00000000-0000-0000-0000-00000000dc0a/x.jpg')$q$,
    'An active coach uploaded into another coach folder');
SELECT pg_temp.expect_refused(
    $q$INSERT INTO storage.objects(bucket_id, name) VALUES ('child-photos', '00000000-0000-0000-0000-00000000c0ac/child/x.jpg')$q$,
    'A coach uploaded a child photo');
DO $$
DECLARE
    v_count INT;
BEGIN
    UPDATE storage.objects SET name = '00000000-0000-0000-0000-00000000c0ac/renamed.jpg'
    WHERE name = '00000000-0000-0000-0000-00000000c0ac/new.jpg';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'An active coach could not replace their photo'; END IF;

    DELETE FROM storage.objects
    WHERE name = 'e0000000-0000-4000-8000-000000000001/routes/f0000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.gpx';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 0 THEN RAISE EXCEPTION 'The organizer deleted the GPX still used by a route'; END IF;

    DELETE FROM storage.objects
    WHERE name = 'e0000000-0000-4000-8000-000000000001/routes/f0000000-0000-4000-8000-000000000001/22222222-2222-4222-8222-222222222222.gpx';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 0 THEN RAISE EXCEPTION 'The organizer deleted a GPX kept by a registration'; END IF;

    DELETE FROM storage.objects
    WHERE name = 'e0000000-0000-4000-8000-000000000001/routes/f0000000-0000-4000-8000-000000000001/33333333-3333-4333-8333-333333333333.gpx';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'The organizer could not delete an unused GPX'; END IF;

    DELETE FROM storage.objects WHERE name = '00000000-0000-0000-0000-00000000c0ac/renamed.jpg';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'An active coach could not delete their photo'; END IF;
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000dc0a';
SELECT pg_temp.expect_refused(
    $q$INSERT INTO storage.objects(bucket_id, name) VALUES ('coach-photos', '00000000-0000-0000-0000-00000000dc0a/x.jpg')$q$,
    'A disabled coach uploaded a coach photo');
SELECT pg_temp.expect_refused(
    $q$INSERT INTO storage.objects(bucket_id, name) VALUES ('announcement-media', 'a0000000-0000-4000-8000-000000000002/x.mp4')$q$,
    'A disabled coach uploaded announcement media');
DO $$
DECLARE
    v_count INT;
BEGIN
    UPDATE storage.objects SET name = name || '.x' WHERE bucket_id = 'coach-photos';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 0 THEN RAISE EXCEPTION 'A disabled coach replaced a coach photo'; END IF;
    DELETE FROM storage.objects WHERE bucket_id = 'coach-photos';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 0 THEN RAISE EXCEPTION 'A disabled coach deleted a coach photo'; END IF;
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000aa01';
SELECT pg_temp.expect_refused(
    $q$INSERT INTO storage.objects(bucket_id, name) VALUES ('coach-photos', '00000000-0000-0000-0000-00000000aa01/x.html')$q$,
    'A parent uploaded into coach-photos');
SELECT pg_temp.expect_refused(
    $q$INSERT INTO storage.objects(bucket_id, name) VALUES ('child-photos', '00000000-0000-0000-0000-00000000de01/child/x.jpg')$q$,
    'A parent uploaded into another parent folder');
INSERT INTO storage.objects(bucket_id, name) VALUES ('child-photos', '00000000-0000-0000-0000-00000000aa01/child/new.jpg');
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT count(*) INTO v_count FROM storage.objects WHERE bucket_id = 'child-photos';
    IF v_count <> 2 THEN RAISE EXCEPTION 'A parent must see only their two child photos, saw %', v_count; END IF;
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000da01';
SELECT pg_temp.expect_refused(
    $q$INSERT INTO storage.objects(bucket_id, name) VALUES ('child-photos', '00000000-0000-0000-0000-00000000da01/child/x.jpg')$q$,
    'A disabled parent uploaded a child photo');

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000de01';
DO $$
DECLARE
    v_count INT;
BEGIN
    DELETE FROM storage.objects WHERE bucket_id = 'child-photos';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'A deleted parent could not erase their own child photos (deleted %)', v_count; END IF;
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000c1b00';
INSERT INTO storage.objects(bucket_id, name) VALUES ('announcement-media', 'b0000000-0000-4000-8000-000000000001/poster.jpg');
SELECT pg_temp.expect_refused(
    $q$INSERT INTO storage.objects(bucket_id, name) VALUES ('announcement-media', 'a0000000-0000-4000-8000-000000000001/x.jpg')$q$,
    'A club uploaded media for a course announcement it does not own');

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000dc1b0';
SELECT pg_temp.expect_refused(
    $q$INSERT INTO storage.objects(bucket_id, name) VALUES ('announcement-media', 'b0000000-0000-4000-8000-000000000002/x.jpg')$q$,
    'A disabled club uploaded announcement media');

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
INSERT INTO storage.objects(bucket_id, name) VALUES
    ('coach-photos', '00000000-0000-0000-0000-00000000c0ac/by-admin.jpg'),
    ('announcement-media', 'a0000000-0000-4000-8000-000000000002/by-admin.jpg');
DO $$
DECLARE
    v_count INT;
BEGIN
    DELETE FROM storage.objects WHERE name = '00000000-0000-0000-0000-00000000c0ac/by-admin.jpg';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'Admin lost access to coach photos'; END IF;
END;
$$;

RESET ROLE;
SET LOCAL ROLE anon;
RESET request.jwt.claim.sub;
SELECT pg_temp.expect_refused(
    $q$INSERT INTO storage.objects(bucket_id, name) VALUES ('coach-photos', 'anon/x.jpg')$q$,
    'An anonymous visitor uploaded a coach photo');
SELECT pg_temp.expect_refused(
    $q$INSERT INTO storage.objects(bucket_id, name) VALUES ('child-photos', 'anon/child/x.jpg')$q$,
    'An anonymous visitor uploaded a child photo');

RESET ROLE;
ROLLBACK;
\echo 'photo-bucket-limits-and-active-writes: OK'
