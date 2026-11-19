\set ON_ERROR_STOP on
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID
$$;
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY, role TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT true, deleted_at TIMESTAMPTZ
);
CREATE TABLE public.clubs (id UUID PRIMARY KEY, owner_user_id UUID NOT NULL REFERENCES public.profiles(id));
CREATE TABLE public.coach_profiles (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES public.profiles(id));
CREATE TABLE public.club_coaches (
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    coach_profile_id UUID NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
    PRIMARY KEY (club_id, coach_profile_id)
);
ALTER TABLE public.club_coaches ENABLE ROW LEVEL SECURITY;
CREATE POLICY club_coaches_select ON public.club_coaches FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT, UPDATE ON public.club_coaches TO anon, authenticated;

CREATE FUNCTION private.caller_is_active() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid()) AND p.enabled AND p.deleted_at IS NULL)
$$;
CREATE FUNCTION public.get_my_role() RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p.role FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.enabled AND p.deleted_at IS NULL
$$;
CREATE FUNCTION public.my_club_ids() RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT c.id FROM public.clubs c
    WHERE c.owner_user_id = (SELECT auth.uid()) AND (SELECT private.caller_is_active())
$$;

\i /tmp/club-head-coach-migration.sql

CREATE FUNCTION public.test_uuid(n INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-4000-8000-' || lpad(n::TEXT, 12, '0'))::UUID
$$;
CREATE FUNCTION public.test_assert(value BOOLEAN, label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', label; END IF; END
$$;
CREATE FUNCTION public.test_set(actor INTEGER, club INTEGER, coach INTEGER) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('request.jwt.claim.sub', COALESCE(public.test_uuid(actor)::TEXT, ''), true);
    SET LOCAL ROLE authenticated;
    PERFORM public.set_club_head_coach(public.test_uuid(club), public.test_uuid(coach));
    RESET ROLE;
    RETURN 'OK';
EXCEPTION
    WHEN insufficient_privilege THEN RETURN 'FORBIDDEN';
    WHEN no_data_found THEN RETURN 'NOT_MEMBER';
END
$$;
CREATE FUNCTION public.test_heads(club INTEGER) RETURNS TEXT LANGUAGE sql AS $$
    SELECT COALESCE(string_agg(right(coach_profile_id::TEXT, 2), ',' ORDER BY coach_profile_id), '-')
    FROM public.club_coaches WHERE club_id = public.test_uuid(club) AND is_head
$$;
GRANT EXECUTE ON FUNCTION public.test_uuid(INTEGER), public.test_heads(INTEGER) TO authenticated;

INSERT INTO public.profiles (id, role, enabled, deleted_at) VALUES
    (public.test_uuid(1), 'CLUB', true, NULL), (public.test_uuid(2), 'CLUB', true, NULL),
    (public.test_uuid(3), 'COACH', true, NULL), (public.test_uuid(4), 'COACH', true, NULL),
    (public.test_uuid(5), 'ADMIN', true, NULL), (public.test_uuid(6), 'PARENT', true, NULL),
    (public.test_uuid(7), 'CLUB', false, NULL), (public.test_uuid(8), 'COACH', true, NULL);
INSERT INTO public.clubs VALUES
    (public.test_uuid(11), public.test_uuid(1)), (public.test_uuid(12), public.test_uuid(2)),
    (public.test_uuid(13), public.test_uuid(7));
INSERT INTO public.coach_profiles VALUES
    (public.test_uuid(31), public.test_uuid(3)), (public.test_uuid(32), public.test_uuid(4)),
    (public.test_uuid(33), public.test_uuid(8));
INSERT INTO public.club_coaches VALUES
    (public.test_uuid(11), public.test_uuid(31)), (public.test_uuid(11), public.test_uuid(32)),
    (public.test_uuid(12), public.test_uuid(33)), (public.test_uuid(13), public.test_uuid(31));

SELECT public.test_assert(NOT has_function_privilege('anon', 'public.set_club_head_coach(uuid, uuid)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.set_club_head_coach(uuid, uuid)', 'EXECUTE'),
    'only signed-in accounts may call it');
SELECT public.test_assert(public.test_heads(11) = '-', 'existing rows start without a head');
SELECT public.test_assert(public.test_set(1, 11, 31) = 'OK' AND public.test_heads(11) = '31', 'club owner marks a head');
SELECT public.test_assert(public.test_set(1, 11, 32) = 'OK' AND public.test_heads(11) = '32', 'marking another coach moves the mark');
SELECT public.test_assert(public.test_set(1, 11, 32) = 'OK' AND public.test_heads(11) = '32', 'repeating the call keeps one head');
SELECT public.test_assert(public.test_set(1, 11, NULL) = 'OK' AND public.test_heads(11) = '-', 'null clears the head');
SELECT public.test_assert(public.test_set(5, 11, 31) = 'OK' AND public.test_heads(11) = '31', 'admin marks a head');
SELECT public.test_assert(public.test_set(2, 11, 32) = 'FORBIDDEN' AND public.test_heads(11) = '31', 'another club is refused');
SELECT public.test_assert(public.test_set(3, 11, 31) = 'FORBIDDEN', 'the coach himself is refused');
SELECT public.test_assert(public.test_set(6, 11, 31) = 'FORBIDDEN', 'parent is refused');
SELECT public.test_assert(public.test_set(7, 13, 31) = 'FORBIDDEN', 'disabled club account is refused');
SELECT public.test_assert(public.test_set(NULL, 11, 31) = 'FORBIDDEN', 'missing session is refused');
SELECT public.test_assert(public.test_set(1, 11, 33) = 'NOT_MEMBER' AND public.test_heads(11) = '31', 'coach of another club is refused');
SELECT public.test_assert(public.test_set(2, 12, 33) = 'OK' AND public.test_heads(12) = '33' AND public.test_heads(11) = '31',
    'clubs keep separate heads');
DO $$ BEGIN
    UPDATE public.club_coaches SET is_head = true WHERE club_id = public.test_uuid(11);
    RAISE EXCEPTION 'Assertion failed: two heads accepted';
EXCEPTION WHEN unique_violation THEN NULL;
END $$;
SELECT set_config('request.jwt.claim.sub', public.test_uuid(1)::TEXT, false);
SET ROLE authenticated;
UPDATE public.club_coaches SET is_head = true WHERE club_id = public.test_uuid(11) AND coach_profile_id = public.test_uuid(32);
SELECT public.test_assert(public.test_heads(11) = '31', 'direct table updates stay closed for the club');
RESET ROLE;
SET ROLE anon;
SELECT public.test_assert((SELECT count(*) = 1 FROM public.club_coaches WHERE is_head AND club_id = public.test_uuid(11)),
    'visitors can read the head mark');
RESET ROLE;
SELECT 'Club head coach assertions passed' AS result;
