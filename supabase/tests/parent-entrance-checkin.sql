\set ON_ERROR_STOP on
CREATE SCHEMA IF NOT EXISTS auth;
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY);
DO $$ BEGIN
    IF to_regprocedure('auth.uid()') IS NULL THEN
        CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::UUID';
    END IF;
END $$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('COACH', 'ADMIN', 'PARENT', 'CLUB')),
    enabled BOOLEAN NOT NULL DEFAULT true,
    name TEXT NOT NULL DEFAULT 'Profil',
    deleted_at TIMESTAMPTZ
);
CREATE TABLE public.courses (
    id UUID PRIMARY KEY, coach_id UUID NOT NULL REFERENCES public.profiles(id), name TEXT NOT NULL DEFAULT 'Curs'
);
CREATE TABLE public.course_occurrences (
    id UUID PRIMARY KEY, course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(), ends_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.children (
    id UUID PRIMARY KEY, parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL, qr_token TEXT NOT NULL UNIQUE
);
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL CHECK (kind IN ('COURSE', 'CAMP', 'ACTIVITY')),
    entity_id UUID NOT NULL, child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PENDING', 'CANCELLED')),
    remaining_sessions INTEGER NOT NULL DEFAULT 0, sessions_used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id UUID NOT NULL REFERENCES public.course_occurrences(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT')),
    UNIQUE (occurrence_id, child_id)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.attendance TO authenticated, service_role;
CREATE POLICY attendance_select ON public.attendance FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.courses, public.course_occurrences, public.children, public.enrollments TO authenticated;

\i /tmp/transactional-attendance-migration.sql
\i /tmp/attendance-after-session-start-migration.sql
\i /tmp/parent-entrance-checkin-migration.sql

CREATE FUNCTION public.test_uuid(n INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-0000-0000-' || lpad(n::TEXT, 12, '0'))::UUID
$$;
CREATE FUNCTION public.test_assert(value BOOLEAN, label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', label; END IF; END
$$;
CREATE FUNCTION public.test_as(n INTEGER) RETURNS VOID LANGUAGE sql AS $$
    SELECT set_config('request.jwt.claim.sub', public.test_uuid(n)::TEXT, false)
$$;
CREATE FUNCTION public.test_token(coach INTEGER) RETURNS TEXT LANGUAGE sql SECURITY DEFINER AS $$
    SELECT token FROM public.coach_entrance_codes WHERE coach_id = public.test_uuid(coach)
$$;
CREATE FUNCTION public.test_checkin(req INTEGER, child INTEGER, occurrence INTEGER DEFAULT 101, coach INTEGER DEFAULT 1)
RETURNS JSONB LANGUAGE sql AS $$
    SELECT public.entrance_checkin(public.test_token(coach), public.test_uuid(occurrence),
        public.test_uuid(child), public.test_uuid(20000 + req))
$$;
CREATE FUNCTION public.test_coach_scan(req INTEGER, child INTEGER, occurrence INTEGER DEFAULT 101) RETURNS JSONB LANGUAGE sql AS $$
    SELECT public.record_attendance_transaction(public.test_uuid(1), jsonb_build_object(
        'requestId', public.test_uuid(30000 + req), 'occurrenceId', public.test_uuid(occurrence),
        'status', 'PRESENT', 'qrToken', md5(public.test_uuid(child)::TEXT)))
$$;
CREATE FUNCTION public.test_coach_mark(req INTEGER, child INTEGER, status TEXT, occurrence INTEGER DEFAULT 101) RETURNS JSONB LANGUAGE sql AS $$
    SELECT public.record_attendance_transaction(public.test_uuid(1), jsonb_build_object(
        'requestId', public.test_uuid(30000 + req), 'occurrenceId', public.test_uuid(occurrence),
        'status', status, 'childId', public.test_uuid(child)))
$$;
CREATE FUNCTION public.test_balance(child INTEGER) RETURNS TEXT LANGUAGE sql AS $$
    SELECT string_agg(remaining_sessions || '/' || sessions_used, ',' ORDER BY id)
    FROM public.enrollments WHERE child_id = public.test_uuid(child) AND status = 'ACTIVE'
$$;
CREATE FUNCTION public.test_option(options JSONB, occurrence INTEGER, child INTEGER) RETURNS JSONB LANGUAGE sql AS $$
    SELECT o FROM jsonb_array_elements(options->'options') o
    WHERE o->>'occurrenceId' = public.test_uuid(occurrence)::TEXT AND o->>'childId' = public.test_uuid(child)::TEXT
$$;

INSERT INTO auth.users (id) SELECT public.test_uuid(n) FROM generate_series(1, 9) n;
INSERT INTO public.profiles (id, role, enabled, name) VALUES
    (public.test_uuid(1), 'COACH', true, 'Antrenor Unu'), (public.test_uuid(2), 'PARENT', true, 'Părinte Doi'),
    (public.test_uuid(3), 'COACH', true, 'Antrenor Trei'), (public.test_uuid(4), 'ADMIN', true, 'Admin'),
    (public.test_uuid(5), 'COACH', false, 'Antrenor dezactivat'), (public.test_uuid(6), 'PARENT', true, 'Părinte fără copii'),
    (public.test_uuid(7), 'PARENT', true, 'Părinte Șapte'), (public.test_uuid(8), 'PARENT', false, 'Părinte dezactivat'),
    (public.test_uuid(9), 'CLUB', true, 'Club');
INSERT INTO public.courses (id, coach_id, name) VALUES
    (public.test_uuid(11), public.test_uuid(1), 'Înot începători'), (public.test_uuid(12), public.test_uuid(3), 'Alergare'),
    (public.test_uuid(13), public.test_uuid(1), 'Înot avansați'), (public.test_uuid(14), public.test_uuid(1), 'Înot seara'),
    (public.test_uuid(15), public.test_uuid(1), 'Înot dimineața');
INSERT INTO public.course_occurrences (id, course_id, starts_at, ends_at) VALUES
    (public.test_uuid(101), public.test_uuid(11), now() - INTERVAL '5 minutes', now() + INTERVAL '55 minutes'),
    (public.test_uuid(102), public.test_uuid(13), now() - INTERVAL '30 minutes', now() + INTERVAL '30 minutes'),
    (public.test_uuid(103), public.test_uuid(12), now() - INTERVAL '5 minutes', now() + INTERVAL '55 minutes'),
    (public.test_uuid(104), public.test_uuid(11), now() + INTERVAL '20 minutes', now() + INTERVAL '80 minutes'),
    (public.test_uuid(105), public.test_uuid(11), now() - INTERVAL '2 hours', now() - INTERVAL '1 hour'),
    (public.test_uuid(106), public.test_uuid(14), now() + INTERVAL '3 hours', now() + INTERVAL '4 hours'),
    (public.test_uuid(107), public.test_uuid(15), now() + INTERVAL '10 minutes', now() + INTERVAL '70 minutes');
INSERT INTO public.children (id, parent_id, name, qr_token)
    SELECT public.test_uuid(n), public.test_uuid(2), 'Copil ' || n, md5(public.test_uuid(n)::TEXT) FROM generate_series(201, 220) n;
INSERT INTO public.children (id, parent_id, name, qr_token) VALUES
    (public.test_uuid(301), public.test_uuid(7), 'Copil străin', md5(public.test_uuid(301)::TEXT)),
    (public.test_uuid(302), public.test_uuid(8), 'Copil cont dezactivat', md5(public.test_uuid(302)::TEXT)),
    (public.test_uuid(303), public.test_uuid(7), 'Copil seara', md5(public.test_uuid(303)::TEXT));
INSERT INTO public.enrollments (id, kind, entity_id, child_id, status, remaining_sessions)
    SELECT public.test_uuid(n + 1000), 'COURSE', public.test_uuid(11), public.test_uuid(n), 'ACTIVE', 3 FROM generate_series(201, 220) n;
INSERT INTO public.enrollments (id, kind, entity_id, child_id, status, remaining_sessions) VALUES
    (public.test_uuid(1301), 'COURSE', public.test_uuid(11), public.test_uuid(301), 'ACTIVE', 3),
    (public.test_uuid(1302), 'COURSE', public.test_uuid(11), public.test_uuid(302), 'ACTIVE', 3),
    (public.test_uuid(1303), 'COURSE', public.test_uuid(14), public.test_uuid(303), 'ACTIVE', 3),
    (public.test_uuid(2201), 'COURSE', public.test_uuid(13), public.test_uuid(201), 'ACTIVE', 5),
    (public.test_uuid(2219), 'COURSE', public.test_uuid(15), public.test_uuid(219), 'ACTIVE', 3),
    (public.test_uuid(2203), 'CAMP', public.test_uuid(13), public.test_uuid(210), 'ACTIVE', 5);

SELECT public.test_assert((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.coach_entrance_codes'::regclass)
    AND NOT has_table_privilege('authenticated', 'public.coach_entrance_codes', 'SELECT,INSERT,UPDATE,DELETE')
    AND NOT has_table_privilege('anon', 'public.coach_entrance_codes', 'SELECT,INSERT,UPDATE,DELETE')
    AND has_table_privilege('service_role', 'public.coach_entrance_codes', 'SELECT'), 'entrance codes table is private with RLS');
SELECT public.test_assert(bool_and(has_function_privilege('authenticated', f, 'EXECUTE') AND NOT has_function_privilege('anon', f, 'EXECUTE')),
    'public RPCs are for signed-in accounts only')
    FROM unnest(ARRAY['public.get_coach_entrance_code(uuid)', 'public.rotate_coach_entrance_code(uuid)',
        'public.entrance_checkin_options(text)', 'public.entrance_checkin(text,uuid,uuid,uuid)']) f;
SELECT public.test_assert(NOT has_function_privilege('authenticated', 'public.entrance_code_owner(uuid)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.entrance_code_owner(uuid)', 'EXECUTE'), 'helper is internal');
SELECT public.test_assert((SELECT bool_and(prosecdef) FROM pg_proc WHERE proname IN ('get_coach_entrance_code',
    'rotate_coach_entrance_code', 'entrance_checkin_options', 'entrance_checkin', 'entrance_code_owner')), 'functions are security definer');
SET ROLE anon;
DO $$ BEGIN
    BEGIN
        PERFORM public.entrance_checkin_options(repeat('a', 32));
        RAISE EXCEPTION 'anon RPC unexpectedly allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

SET ROLE authenticated;
SELECT public.test_as(1);
DO $$ BEGIN
    BEGIN
        PERFORM token FROM public.coach_entrance_codes;
        RAISE EXCEPTION 'authenticated table read unexpectedly allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
        PERFORM public.entrance_code_owner(NULL);
        RAISE EXCEPTION 'authenticated helper call unexpectedly allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT public.test_assert(public.get_coach_entrance_code()->>'token' ~ '^[0-9a-f]{32}$', 'coach gets a code');
SELECT public.test_assert(public.get_coach_entrance_code()->>'coachName' = 'Antrenor Unu', 'code carries the coach name');
SELECT public.test_assert(public.get_coach_entrance_code()->>'token' = public.get_coach_entrance_code()->>'token', 'code is stable');
SELECT public.test_assert(public.get_coach_entrance_code(public.test_uuid(3))->>'code' = 'FORBIDDEN', 'coach cannot read another coach code');
SELECT public.test_as(3);
SELECT public.test_assert(public.get_coach_entrance_code()->>'success' = 'true', 'second coach gets a code');
SELECT public.test_as(4);
SELECT public.test_assert(public.get_coach_entrance_code(public.test_uuid(1))->>'token' = public.test_token(1), 'admin reads a coach code');
SELECT public.test_assert(public.get_coach_entrance_code(public.test_uuid(2))->>'code' = 'COACH_NOT_FOUND', 'admin cannot make a parent code');
SELECT public.test_assert(public.get_coach_entrance_code(public.test_uuid(5))->>'code' = 'COACH_NOT_FOUND', 'no code for a disabled coach');
SELECT public.test_as(2);
SELECT public.test_assert(public.get_coach_entrance_code()->>'code' = 'FORBIDDEN', 'parent has no code');
SELECT public.test_assert(public.rotate_coach_entrance_code(public.test_uuid(1))->>'code' = 'FORBIDDEN', 'parent cannot rotate');
SELECT public.test_as(9);
SELECT public.test_assert(public.get_coach_entrance_code(public.test_uuid(1))->>'code' = 'FORBIDDEN', 'club cannot read a coach code');
SELECT public.test_as(3);
DO $$
DECLARE v_old TEXT := public.test_token(3); v_new JSONB;
BEGIN
    v_new := public.rotate_coach_entrance_code();
    PERFORM public.test_assert(v_new->>'success' = 'true' AND v_new->>'token' <> v_old, 'rotation issues a new code');
    PERFORM public.test_as(2);
    PERFORM public.test_assert(public.entrance_checkin_options(v_old)->>'code' = 'INVALID_CODE', 'rotated code stops working');
END $$;

SELECT public.test_as(2);
SELECT public.test_assert(public.entrance_checkin_options('MT1:abc')->>'code' = 'INVALID_CODE', 'malformed code');
SELECT public.test_assert(public.entrance_checkin_options(md5(public.test_uuid(201)::TEXT))->>'code' = 'INVALID_CODE', 'child QR is not an entrance code');
SELECT public.test_assert(public.entrance_checkin_options(NULL)->>'code' = 'INVALID_CODE', 'missing code');
DO $$
DECLARE v JSONB := public.entrance_checkin_options(public.test_token(1));
BEGIN
    PERFORM public.test_assert(v->>'success' = 'true' AND v->>'coachName' = 'Antrenor Unu', 'options for a valid code');
    PERFORM public.test_assert(jsonb_array_length(v->'options') = 22, 'one option per enrolled child and open session');
    PERFORM public.test_assert(public.test_option(v, 101, 201)->>'state' = 'AVAILABLE'
        AND public.test_option(v, 101, 201)->>'remainingSessions' = '3'
        AND public.test_option(v, 101, 201)->>'courseName' = 'Înot începători', 'available option details');
    PERFORM public.test_assert(public.test_option(v, 104, 201) IS NULL, 'session 20 minutes ahead is not offered');
    PERFORM public.test_assert(public.test_option(v, 105, 201) IS NULL, 'ended session is not offered');
    PERFORM public.test_assert(public.test_option(v, 103, 201) IS NULL, 'other coach session is not offered');
    PERFORM public.test_assert(public.test_option(v, 101, 301) IS NULL, 'other parent child is not offered');
END $$;
SELECT public.test_assert(public.test_option(public.entrance_checkin_options(public.test_token(1)), 102, 201)->>'state' = 'AVAILABLE',
    'started session of another course of the same coach is offered too');
SELECT public.test_assert((SELECT count(*) = 22 FROM jsonb_array_elements(public.entrance_checkin_options(public.test_token(1))->'options')),
    'several children and several sessions are offered for choice');
SELECT public.test_assert(public.entrance_checkin_options(public.test_token(3))->>'code' = 'NOT_ENROLLED', 'no child at that coach');
RESET ROLE;
UPDATE public.enrollments SET status = 'CANCELLED' WHERE id = public.test_uuid(1301);
SET ROLE authenticated;
SELECT public.test_as(7);
DO $$
DECLARE v JSONB;
BEGIN
    v := public.entrance_checkin_options(public.test_token(1));
    PERFORM public.test_assert(v->>'code' = 'OUTSIDE_WINDOW', 'enrolled only in a later session');
    PERFORM public.test_assert((v->>'nextOpensAt')::TIMESTAMPTZ = (SELECT starts_at - INTERVAL '15 minutes'
        FROM public.course_occurrences WHERE id = public.test_uuid(106)), 'next window opens 15 minutes before the next session');
END $$;
RESET ROLE;
UPDATE public.enrollments SET status = 'ACTIVE' WHERE id = public.test_uuid(1301);
SET ROLE authenticated;
SELECT public.test_as(6);
SELECT public.test_assert(public.entrance_checkin_options(public.test_token(1))->>'code' = 'NOT_ENROLLED', 'parent without children');
SELECT public.test_as(8);
SELECT public.test_assert(public.entrance_checkin_options(public.test_token(1))->>'code' = 'FORBIDDEN', 'disabled parent');
SELECT public.test_as(1);
SELECT public.test_assert(public.entrance_checkin_options(public.test_token(1))->>'code' = 'FORBIDDEN', 'coach cannot check in');
SELECT public.test_as(4);
SELECT public.test_assert(public.entrance_checkin_options(public.test_token(1))->>'code' = 'FORBIDDEN', 'admin cannot check in as parent');

SELECT public.test_as(2);
SELECT public.test_assert(public.test_checkin(1, 201)->>'outcome' = 'recorded', 'parent check-in records');
SELECT public.test_assert(public.test_balance(201) = '2/1,5/0', 'check-in debits exactly the course enrollment');
SELECT public.test_assert(public.test_checkin(1, 201)->>'outcome' = 'recorded', 'lost-response retry returns original receipt');
SELECT public.test_assert(public.test_checkin(2, 201)->>'outcome' = 'duplicate', 'second scan is duplicate');
SELECT public.test_assert(public.test_checkin(1, 202)->>'code' = 'REQUEST_CONFLICT', 'request ID payload binding');
SELECT public.test_assert(public.test_balance(201) = '2/1,5/0', 'retries never debit');
DO $$
DECLARE v JSONB := public.test_checkin(3, 201);
BEGIN
    PERFORM public.test_assert(v->>'childName' = 'Copil 201' AND v->>'courseName' = 'Înot începători'
        AND v->>'attendanceStatus' = 'PRESENT' AND v->>'remainingSessions' = '2', 'result details');
END $$;
SELECT public.test_assert(public.test_option(public.entrance_checkin_options(public.test_token(1)), 101, 201)->>'state' = 'ALREADY_PRESENT',
    'option shows already present');
RESET ROLE;
SELECT public.test_assert(public.test_coach_scan(1, 201)->>'outcome' = 'duplicate', 'coach scan after parent check-in is duplicate');
SELECT public.test_assert(public.test_balance(201) = '2/1,5/0', 'coach scan after parent does not debit');
SELECT public.test_assert(public.test_coach_scan(2, 202)->>'outcome' = 'recorded', 'coach scans first');
SET ROLE authenticated;
SELECT public.test_as(2);
SELECT public.test_assert(public.test_checkin(4, 202)->>'outcome' = 'duplicate', 'parent check-in after coach scan is duplicate');
SELECT public.test_assert(public.test_balance(202) = '2/1', 'parent after coach does not debit');
RESET ROLE;
SELECT public.test_coach_mark(3, 203, 'PRESENT');
SET ROLE authenticated;
SELECT public.test_as(2);
SELECT public.test_assert(public.test_checkin(5, 203)->>'outcome' = 'duplicate', 'manual present then check-in is duplicate');
SELECT public.test_assert(public.test_balance(203) = '2/1', 'manual present then check-in debits once');
RESET ROLE;
SELECT public.test_assert(public.test_coach_mark(4, 201, 'ABSENT')->>'outcome' = 'recorded', 'coach corrects to absent after check-in');
SELECT public.test_assert(public.test_balance(201) = '3/0,5/0', 'correction refunds the session');
SET ROLE authenticated;
SELECT public.test_as(2);
SELECT public.test_assert(public.test_checkin(6, 201)->>'code' = 'MANUAL_OVERRIDE', 'coach correction wins over a new check-in');
SELECT public.test_assert(public.test_option(public.entrance_checkin_options(public.test_token(1)), 101, 201)->>'state' = 'MANUAL_OVERRIDE',
    'option shows coach correction');
SELECT public.test_assert(public.test_balance(201) = '3/0,5/0', 'refused check-in leaves the balance');
RESET ROLE;
SELECT public.test_coach_mark(5, 204, 'ABSENT');
SELECT public.test_coach_mark(6, 205, NULL);
SET ROLE authenticated;
SELECT public.test_as(2);
SELECT public.test_assert(public.test_checkin(7, 204)->>'code' = 'MANUAL_OVERRIDE', 'manual absent before check-in wins');
SELECT public.test_assert(public.test_checkin(8, 205)->>'code' = 'MANUAL_OVERRIDE', 'manual clear before check-in wins');

SELECT public.test_assert(public.test_checkin(10, 301)->>'code' = 'CHILD_NOT_FOUND', 'other parent child refused');
SELECT public.test_assert(public.test_checkin(11, 206, 103)->>'code' = 'OCCURRENCE_NOT_FOUND', 'session of another coach refused');
SELECT public.test_assert(public.test_checkin(12, 206, 103, 3)->>'code' = 'NOT_ENROLLED', 'session of a course without enrollment refused');
SELECT public.test_assert(public.test_checkin(13, 206, 999)->>'code' = 'OCCURRENCE_NOT_FOUND', 'unknown session refused');
SELECT public.test_assert(public.test_option(public.entrance_checkin_options(public.test_token(1)), 107, 219)->>'state' = 'AVAILABLE',
    'session starting in 10 minutes is offered');
SELECT public.test_assert(public.test_checkin(9, 219, 107)->>'outcome' = 'recorded', 'check-in 10 minutes before the start records');
SELECT public.test_assert(public.test_balance(219) = '3/0,2/1', 'early check-in debits the right course');
SELECT public.test_assert(public.test_checkin(14, 206, 104)->>'code' = 'OUTSIDE_WINDOW', 'more than 15 minutes early refused');
SELECT public.test_assert(public.test_checkin(15, 206, 105)->>'code' = 'OUTSIDE_WINDOW', 'ended session refused');
SELECT public.test_assert(public.entrance_checkin(public.test_token(1), public.test_uuid(101), public.test_uuid(206), NULL)->>'code' = 'INVALID_REQUEST', 'missing request id');
SELECT public.test_assert(public.entrance_checkin('nope', public.test_uuid(101), public.test_uuid(206), public.test_uuid(29999))->>'code' = 'INVALID_CODE', 'malformed code');
SELECT public.test_assert(public.entrance_checkin(repeat('0', 32), public.test_uuid(101), public.test_uuid(206), public.test_uuid(29998))->>'code' = 'INVALID_CODE', 'unknown code');
RESET ROLE;
UPDATE public.enrollments SET status = 'CANCELLED' WHERE id = public.test_uuid(1207);
UPDATE public.enrollments SET remaining_sessions = 0 WHERE id = public.test_uuid(1208);
INSERT INTO public.enrollments (kind, entity_id, child_id, status, remaining_sessions)
    VALUES ('COURSE', public.test_uuid(11), public.test_uuid(209), 'ACTIVE', 3);
SET ROLE authenticated;
SELECT public.test_as(2);
SELECT public.test_assert(public.test_checkin(16, 207)->>'code' = 'NOT_ENROLLED', 'cancelled enrollment refused');
SELECT public.test_assert(public.test_checkin(17, 208)->>'code' = 'NO_REMAINING_SESSIONS', 'no sessions left refused');
SELECT public.test_assert(public.test_checkin(18, 209)->>'code' = 'AMBIGUOUS_ENROLLMENT', 'ambiguous enrollment refused');
DO $$
DECLARE v JSONB := public.entrance_checkin_options(public.test_token(1));
BEGIN
    PERFORM public.test_assert(public.test_option(v, 101, 207) IS NULL, 'cancelled enrollment not offered');
    PERFORM public.test_assert(public.test_option(v, 101, 208)->>'state' = 'NO_REMAINING_SESSIONS', 'option shows empty balance');
    PERFORM public.test_assert(public.test_option(v, 101, 209)->>'state' = 'AMBIGUOUS_ENROLLMENT'
        AND public.test_option(v, 101, 209)->'remainingSessions' = 'null'::JSONB, 'option shows ambiguous enrollment');
END $$;
SELECT public.test_assert(public.test_balance(207) IS NULL AND public.test_balance(208) = '0/0', 'refusals leave balances');
SELECT public.test_assert(public.test_checkin(20, 210, 102)->>'code' = 'NOT_ENROLLED', 'child enrolled only in another course of the coach');
SELECT public.test_assert(public.test_checkin(21, 201, 102)->>'outcome' = 'recorded', 'started session of the second course records');
SELECT public.test_assert(public.test_balance(201) = '3/0,4/1', 'second course debits its own enrollment');
SELECT public.test_as(8);
SELECT public.test_assert(public.test_checkin(22, 302)->>'code' = 'FORBIDDEN', 'disabled parent cannot check in');
SELECT public.test_as(1);
SELECT public.test_assert(public.test_checkin(23, 211)->>'code' = 'FORBIDDEN', 'coach cannot use the parent check-in');
RESET ROLE;
UPDATE public.profiles SET enabled = false WHERE id = public.test_uuid(1);
SET ROLE authenticated;
SELECT public.test_as(2);
SELECT public.test_assert(public.test_checkin(24, 211)->>'code' = 'INVALID_CODE', 'disabled coach code stops working');
SELECT public.test_assert(public.entrance_checkin_options(public.test_token(1))->>'code' = 'INVALID_CODE', 'disabled coach options stop');
RESET ROLE;
UPDATE public.profiles SET enabled = true WHERE id = public.test_uuid(1);
SELECT public.test_assert(NOT EXISTS (SELECT FROM public.attendance_operations
    WHERE actor_id = public.test_uuid(2) AND (result->>'success')::BOOLEAN IS NOT TRUE), 'only successful check-ins leave receipts');
SELECT public.test_assert((SELECT count(*) = 1 FROM public.attendance_operations
    WHERE actor_id = public.test_uuid(2) AND request_id = public.test_uuid(20001)), 'one receipt per request');
SELECT 'Parent entrance check-in assertions passed' AS result;
