\set ON_ERROR_STOP on
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
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
CREATE TABLE public.courses (
    id UUID PRIMARY KEY,
    coach_id UUID NOT NULL REFERENCES public.profiles(id),
    club_id UUID REFERENCES public.clubs(id),
    active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.courses TO anon, authenticated;

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
CREATE FUNCTION public.pot_administra_curs(p_course_id UUID) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
    SELECT (SELECT private.caller_is_active())
        AND (
            EXISTS (
                SELECT 1 FROM public.courses c
                WHERE c.id = p_course_id
                  AND (c.club_id IN (SELECT my_club_ids()) OR c.coach_id = (SELECT auth.uid()))
            ) OR (SELECT get_my_role()) = 'ADMIN'
        )
$$;

CREATE POLICY courses_select ON public.courses FOR SELECT TO anon, authenticated
    USING (active OR coach_id = (SELECT auth.uid()) OR club_id IN (SELECT public.my_club_ids()));

\i /tmp/course-packages-migration.sql

CREATE FUNCTION public.test_uuid(n INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-4000-8000-' || lpad(n::TEXT, 12, '0'))::UUID
$$;
CREATE FUNCTION public.test_assert(value BOOLEAN, label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', label; END IF; END
$$;
CREATE FUNCTION public.test_save(actor INTEGER, course INTEGER, packages JSONB) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('request.jwt.claim.sub', COALESCE(public.test_uuid(actor)::TEXT, ''), true);
    SET LOCAL ROLE authenticated;
    PERFORM public.save_course_packages(public.test_uuid(course), packages);
    RESET ROLE;
    RETURN 'OK';
EXCEPTION
    WHEN insufficient_privilege THEN RETURN 'FORBIDDEN';
    WHEN no_data_found THEN RETURN 'UNKNOWN';
    WHEN feature_not_supported THEN RETURN 'MONTHLY';
    WHEN invalid_parameter_value THEN RETURN 'INVALID';
    WHEN check_violation THEN RETURN 'CHECK';
    WHEN unique_violation THEN RETURN 'DUPLICATE';
    WHEN not_null_violation THEN RETURN 'MISSING';
END
$$;
CREATE FUNCTION public.test_list(course INTEGER) RETURNS TEXT LANGUAGE sql AS $$
    SELECT COALESCE(string_agg(position || ':' || sessions || 'x' || price, ',' ORDER BY position), '-')
    FROM public.course_packages WHERE course_id = public.test_uuid(course)
$$;
CREATE FUNCTION public.test_id(course INTEGER, pos INTEGER) RETURNS TEXT LANGUAGE sql AS $$
    SELECT id::TEXT FROM public.course_packages WHERE course_id = public.test_uuid(course) AND position = pos
$$;

INSERT INTO public.profiles (id, role, enabled, deleted_at) VALUES
    (public.test_uuid(1), 'COACH', true, NULL), (public.test_uuid(2), 'COACH', true, NULL),
    (public.test_uuid(3), 'CLUB', true, NULL), (public.test_uuid(4), 'CLUB', true, NULL),
    (public.test_uuid(5), 'ADMIN', true, NULL), (public.test_uuid(6), 'PARENT', true, NULL),
    (public.test_uuid(7), 'COACH', false, NULL), (public.test_uuid(8), 'COACH', true, now());
INSERT INTO public.clubs VALUES (public.test_uuid(13), public.test_uuid(3)), (public.test_uuid(14), public.test_uuid(4));
INSERT INTO public.courses (id, coach_id, club_id, active) VALUES
    (public.test_uuid(21), public.test_uuid(1), NULL, true),
    (public.test_uuid(22), public.test_uuid(2), public.test_uuid(13), true),
    (public.test_uuid(23), public.test_uuid(7), NULL, true),
    (public.test_uuid(24), public.test_uuid(1), NULL, false),
    (public.test_uuid(25), public.test_uuid(8), NULL, true);

SELECT public.test_assert(NOT has_function_privilege('anon', 'public.save_course_packages(uuid, jsonb)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.save_course_packages(uuid, jsonb)', 'EXECUTE'),
    'only signed-in accounts may call the save function');
SELECT public.test_assert(NOT has_table_privilege('authenticated', 'public.course_packages', 'INSERT')
    AND NOT has_table_privilege('authenticated', 'public.course_packages', 'UPDATE')
    AND NOT has_table_privilege('authenticated', 'public.course_packages', 'DELETE')
    AND NOT has_table_privilege('anon', 'public.course_packages', 'INSERT')
    AND has_table_privilege('anon', 'public.course_packages', 'SELECT'),
    'clients only read the table');

SELECT public.test_assert(public.test_save(1, 21, '[{"sessions":5,"price":20000},{"sessions":10,"price":35000}]') = 'OK'
    AND public.test_list(21) = '0:5x20000,1:10x35000', 'course coach saves two packages');
SELECT public.test_assert(public.test_save(3, 22, '[{"sessions":8,"price":32000}]') = 'OK'
    AND public.test_list(22) = '0:8x32000', 'club owner saves a package on a club course');
SELECT public.test_assert(public.test_save(5, 21, format('[{"id":"%s","sessions":10,"price":34000},{"id":"%s","sessions":5,"price":20000}]',
    public.test_id(21, 1), public.test_id(21, 0))::jsonb) = 'OK'
    AND public.test_list(21) = '0:10x34000,1:5x20000', 'admin reorders and edits keeping the ids');
SELECT public.test_assert(public.test_save(1, 21, format('[{"id":"%s","sessions":10,"price":34000},{"sessions":20,"price":60000}]',
    public.test_id(21, 0))::jsonb) = 'OK'
    AND public.test_list(21) = '0:10x34000,1:20x60000', 'a missing package is deleted and a new one added');
SELECT public.test_assert(public.test_save(1, 21, '[{"sessions":5,"price":100},{"sessions":10,"price":200}]') = 'OK', 'setup for a sessions swap');
SELECT public.test_assert(public.test_save(1, 21, format('[{"id":"%s","sessions":10,"price":100},{"id":"%s","sessions":5,"price":200}]',
    public.test_id(21, 0), public.test_id(21, 1))::jsonb) = 'OK'
    AND public.test_list(21) = '0:10x100,1:5x200', 'two packages can swap their session counts');
SELECT public.test_assert(public.test_save(1, 21, format('[{"id":"%s","sessions":10,"price":100},{"id":"%s","sessions":6,"price":200}]',
    public.test_id(21, 0), public.test_id(21, 0))::jsonb) = 'UNKNOWN'
    AND public.test_list(21) = '0:10x100,1:5x200', 'the same id twice is refused');
SELECT public.test_assert(public.test_save(1, 21, '[]') = 'OK' AND public.test_list(21) = '-', 'an empty list removes every package');

SELECT public.test_assert(public.test_save(2, 21, '[{"sessions":5,"price":20000}]') = 'FORBIDDEN', 'another coach is refused');
SELECT public.test_assert(public.test_save(4, 22, '[{"sessions":5,"price":20000}]') = 'FORBIDDEN', 'another club is refused');
SELECT public.test_assert(public.test_save(6, 21, '[{"sessions":5,"price":20000}]') = 'FORBIDDEN', 'parent is refused');
SELECT public.test_assert(public.test_save(7, 23, '[{"sessions":5,"price":20000}]') = 'FORBIDDEN', 'disabled coach is refused');
SELECT public.test_assert(public.test_save(NULL, 21, '[{"sessions":5,"price":20000}]') = 'FORBIDDEN', 'missing session is refused');
SELECT public.test_assert(public.test_save(8, 25, '[{"sessions":5,"price":20000}]') = 'FORBIDDEN', 'deleted coach account is refused');
SELECT public.test_assert(public.test_save(5, 99, '[{"sessions":5,"price":20000}]') = 'UNKNOWN', 'admin on a missing course gets not found');
DO $$ BEGIN
    SET LOCAL ROLE anon;
    PERFORM public.save_course_packages(public.test_uuid(21), '[]'::jsonb);
    RAISE EXCEPTION 'Assertion failed: anon could call the save function';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

SELECT public.test_assert(public.test_save(1, 21,
    '[{"sessions":1,"price":1},{"sessions":2,"price":2},{"sessions":3,"price":3},{"sessions":4,"price":4}]') = 'OK',
    'four packages are accepted');
SELECT public.test_assert(public.test_save(1, 21,
    '[{"sessions":1,"price":1},{"sessions":2,"price":2},{"sessions":3,"price":3},{"sessions":4,"price":4},{"sessions":5,"price":5}]') = 'INVALID'
    AND public.test_list(21) = '0:1x1,1:2x2,2:3x3,3:4x4', 'a fifth package is refused and nothing changes');
SELECT public.test_assert(public.test_save(1, 21, '{"sessions":5}') = 'INVALID', 'a non-array payload is refused');
SELECT public.test_assert(public.test_save(1, 21, '[{"sessions":0,"price":100}]') = 'CHECK', 'zero sessions are refused');
SELECT public.test_assert(public.test_save(1, 21, '[{"sessions":5,"price":0}]') = 'CHECK', 'a zero price is refused');
SELECT public.test_assert(public.test_save(1, 21, '[{"sessions":5}]') = 'MISSING', 'a missing price is refused');
SELECT public.test_assert(public.test_save(1, 21, '[{"sessions":5,"price":100},{"sessions":5,"price":200}]') = 'DUPLICATE',
    'two packages with the same sessions are refused');
SELECT public.test_assert(public.test_save(1, 21, '[{"sessions":5,"price":100,"validity":"CALENDAR_MONTH"}]') = 'MONTHLY',
    'monthly packages stay closed until #698');
SELECT public.test_assert(public.test_save(1, 21, format('[{"id":"%s","sessions":5,"price":100}]', public.test_id(22, 0))::jsonb) = 'UNKNOWN'
    AND public.test_list(22) = '0:8x32000', 'a package of another course cannot be moved or edited');
SELECT public.test_assert(public.test_list(21) = '0:1x1,1:2x2,2:3x3,3:4x4', 'refused saves leave the list unchanged');

SELECT public.test_assert(public.test_save(1, 24, '[{"sessions":5,"price":20000}]') = 'OK', 'coach saves on an inactive own course');
SELECT set_config('request.jwt.claim.sub', '', false);
SET ROLE anon;
SELECT public.test_assert((SELECT count(*) = 4 FROM public.course_packages WHERE course_id = public.test_uuid(21)),
    'visitors read packages of an active course');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.course_packages WHERE course_id = public.test_uuid(24)),
    'visitors do not see packages of a hidden course');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', public.test_uuid(1)::TEXT, false);
SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) = 1 FROM public.course_packages WHERE course_id = public.test_uuid(24)),
    'the coach reads packages of the own hidden course');
DO $$ BEGIN
    INSERT INTO public.course_packages (course_id, position, sessions, price) VALUES (public.test_uuid(21), 0, 9, 9);
    RAISE EXCEPTION 'Assertion failed: direct insert accepted';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;
DELETE FROM public.courses WHERE id = public.test_uuid(24);
SELECT public.test_assert((SELECT count(*) = 0 FROM public.course_packages WHERE course_id = public.test_uuid(24)),
    'packages are removed with their course');
SELECT 'Course packages assertions passed' AS result;
