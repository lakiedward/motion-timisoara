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
CREATE TABLE public.clubs (
    id UUID PRIMARY KEY, owner_user_id UUID NOT NULL REFERENCES public.profiles(id), approved_at TIMESTAMPTZ
);
CREATE TABLE public.activities (
    id UUID PRIMARY KEY, coach_id UUID NOT NULL REFERENCES public.profiles(id),
    club_id UUID REFERENCES public.clubs(id)
);
CREATE TABLE public.children (
    id UUID PRIMARY KEY, parent_id UUID NOT NULL REFERENCES public.profiles(id),
    name TEXT NOT NULL, birth_date DATE NOT NULL
);
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), kind TEXT NOT NULL, entity_id UUID NOT NULL,
    child_id UUID REFERENCES public.children(id), adult_profile_id UUID REFERENCES public.profiles(id),
    status TEXT NOT NULL
);
CREATE TABLE public.activity_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES public.activities(id),
    child_id UUID NOT NULL REFERENCES public.children(id),
    status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT')),
    UNIQUE (activity_id, child_id)
);
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_attendance ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.children, public.enrollments, public.activity_attendance TO authenticated;

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
CREATE FUNCTION public.pot_administra_activitate(p_activity_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT (SELECT private.caller_is_active())
        AND (
            EXISTS (
                SELECT 1 FROM public.activities a
                WHERE a.id = p_activity_id
                  AND (a.club_id IN (SELECT my_club_ids()) OR a.coach_id = (SELECT auth.uid()))
            ) OR (SELECT get_my_role()) = 'ADMIN'
        )
$$;

\i /tmp/club-activity-attendance-roster-migration.sql

CREATE FUNCTION public.test_uuid(n INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-0000-0000-' || lpad(n::TEXT, 12, '0'))::UUID
$$;
CREATE FUNCTION public.test_assert(value BOOLEAN, label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', label; END IF; END
$$;
CREATE FUNCTION public.test_roster(actor INTEGER, activity INTEGER) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    v_result TEXT;
BEGIN
    PERFORM set_config('request.jwt.claim.sub', CASE WHEN actor IS NULL THEN '' ELSE public.test_uuid(actor)::TEXT END, true);
    SET LOCAL ROLE authenticated;
    BEGIN
        SELECT coalesce(string_agg(r.child_name || ':' || coalesce(r.status, '-'), ',' ORDER BY r.child_name), '')
            INTO v_result FROM public.activity_attendance_roster(public.test_uuid(activity)) r;
    EXCEPTION WHEN insufficient_privilege THEN
        v_result := 'FORBIDDEN';
    END;
    RESET ROLE;
    RETURN v_result;
END
$$;

INSERT INTO public.profiles (id, role, enabled) VALUES
    (public.test_uuid(1), 'CLUB', true), (public.test_uuid(2), 'CLUB', true), (public.test_uuid(3), 'COACH', true),
    (public.test_uuid(4), 'COACH', true), (public.test_uuid(5), 'ADMIN', true), (public.test_uuid(6), 'PARENT', true),
    (public.test_uuid(7), 'CLUB', false), (public.test_uuid(8), 'CLUB', true), (public.test_uuid(9), 'COACH', true);
UPDATE public.profiles SET deleted_at = now() WHERE id = public.test_uuid(9);
INSERT INTO public.clubs VALUES (public.test_uuid(11), public.test_uuid(1), now()), (public.test_uuid(12), public.test_uuid(2), now()),
    (public.test_uuid(13), public.test_uuid(7), now()), (public.test_uuid(14), public.test_uuid(8), NULL);
INSERT INTO public.activities VALUES (public.test_uuid(21), public.test_uuid(3), public.test_uuid(11)),
    (public.test_uuid(22), public.test_uuid(4), NULL), (public.test_uuid(23), public.test_uuid(3), public.test_uuid(13)),
    (public.test_uuid(24), public.test_uuid(3), public.test_uuid(14)), (public.test_uuid(25), public.test_uuid(9), NULL);
INSERT INTO public.children VALUES
    (public.test_uuid(31), public.test_uuid(6), 'Ana', '2016-03-01'), (public.test_uuid(32), public.test_uuid(6), 'Bogdan', '2017-03-01'),
    (public.test_uuid(33), public.test_uuid(6), 'Carla', '2018-03-01'), (public.test_uuid(34), public.test_uuid(6), 'Dan', '2018-03-01');
INSERT INTO public.enrollments (kind, entity_id, child_id, adult_profile_id, status) VALUES
    ('ACTIVITY', public.test_uuid(21), public.test_uuid(31), NULL, 'ACTIVE'),
    ('ACTIVITY', public.test_uuid(21), public.test_uuid(32), NULL, 'ACTIVE'),
    ('ACTIVITY', public.test_uuid(21), public.test_uuid(32), NULL, 'ACTIVE'),
    ('ACTIVITY', public.test_uuid(24), public.test_uuid(34), NULL, 'ACTIVE'),
    ('ACTIVITY', public.test_uuid(25), public.test_uuid(34), NULL, 'ACTIVE'),
    ('ACTIVITY', public.test_uuid(21), public.test_uuid(33), NULL, 'CANCELLED'),
    ('ACTIVITY', public.test_uuid(21), NULL, public.test_uuid(6), 'ACTIVE'),
    ('COURSE', public.test_uuid(21), public.test_uuid(34), NULL, 'ACTIVE'),
    ('ACTIVITY', public.test_uuid(22), public.test_uuid(34), NULL, 'ACTIVE'),
    ('ACTIVITY', public.test_uuid(23), public.test_uuid(34), NULL, 'ACTIVE');
INSERT INTO public.activity_attendance (activity_id, child_id, status) VALUES
    (public.test_uuid(21), public.test_uuid(32), 'ABSENT'), (public.test_uuid(21), public.test_uuid(33), 'PRESENT');

SELECT public.test_assert(NOT has_function_privilege('anon', 'public.activity_attendance_roster(uuid)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.activity_attendance_roster(uuid)', 'EXECUTE'), 'roster is for signed-in accounts only');
SELECT public.test_assert(public.test_roster(1, 21) = 'Ana:-,Bogdan:ABSENT', 'club owner reads each active child once with its mark');
SELECT public.test_assert(public.test_roster(3, 21) = 'Ana:-,Bogdan:ABSENT', 'activity coach reads the same roster');
SELECT public.test_assert(public.test_roster(5, 22) = 'Dan:-', 'admin reads any roster');
SELECT public.test_assert(public.test_roster(2, 21) = 'FORBIDDEN', 'another club is refused');
SELECT public.test_assert(public.test_roster(1, 22) = 'FORBIDDEN', 'club is refused at an independent coach activity');
SELECT public.test_assert(public.test_roster(4, 21) = 'FORBIDDEN', 'another coach is refused');
SELECT public.test_assert(public.test_roster(6, 21) = 'FORBIDDEN', 'parent is refused');
SELECT public.test_assert(public.test_roster(7, 23) = 'FORBIDDEN', 'disabled club account is refused');
SELECT public.test_assert(public.test_roster(8, 24) = 'FORBIDDEN', 'unapproved club is refused');
SELECT public.test_assert(public.test_roster(3, 24) = 'Dan:-', 'coach of an unapproved club activity still reads it');
SELECT public.test_assert(public.test_roster(9, 25) = 'FORBIDDEN', 'deleted coach account is refused');
SELECT public.test_assert(public.test_roster(NULL, 21) = 'FORBIDDEN', 'missing session is refused');
SELECT public.test_assert(public.test_roster(1, 999) = 'FORBIDDEN', 'unknown activity is refused');
SELECT set_config('request.jwt.claim.sub', public.test_uuid(1)::TEXT, false);
SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) = 0 FROM public.enrollments) AND (SELECT count(*) = 0 FROM public.children),
    'table policies stay closed for the club');
RESET ROLE;
SELECT 'Club activity attendance roster assertions passed' AS result;
