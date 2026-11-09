\set ON_ERROR_STOP on
BEGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
CREATE TABLE public.profiles(id UUID PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, avatar_url TEXT);
CREATE TABLE public.coach_profiles(id UUID PRIMARY KEY, user_id UUID NOT NULL);
CREATE TABLE public.clubs(id UUID PRIMARY KEY, owner_user_id UUID);
CREATE TABLE public.courses(id UUID PRIMARY KEY, coach_id UUID);
CREATE TABLE public.activities(id UUID PRIMARY KEY, coach_id UUID);
CREATE TABLE public.camps(id UUID PRIMARY KEY, coach_id UUID);
CREATE TABLE public.competitions(id UUID PRIMARY KEY, coach_id UUID);
CREATE TABLE public.coach_ratings(id UUID PRIMARY KEY, parent_id UUID NOT NULL, comment TEXT);
CREATE TABLE public.course_ratings(id UUID PRIMARY KEY, parent_id UUID NOT NULL, comment TEXT);
CREATE FUNCTION pg_temp.u(p_n INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-0000-0000-' || lpad(p_n::TEXT, 12, '0'))::UUID
$$;

INSERT INTO public.profiles(id, name, role) VALUES
    (pg_temp.u(1), 'Admin ascuns', 'ADMIN'),
    (pg_temp.u(2), 'Admin antrenor', 'ADMIN'),
    (pg_temp.u(3), 'Antrenor', 'COACH'),
    (pg_temp.u(4), 'Club', 'CLUB'),
    (pg_temp.u(5), 'Părinte fără recenzie', 'PARENT'),
    (pg_temp.u(6), 'Părinte doar stele', 'PARENT'),
    (pg_temp.u(7), 'Părinte cu comentariu antrenor', 'PARENT'),
    (pg_temp.u(8), 'Părinte cu comentariu curs', 'PARENT'),
    (pg_temp.u(9), 'Admin curs', 'ADMIN'),
    (pg_temp.u(10), 'Părinte comentariu gol', 'PARENT');
INSERT INTO public.coach_profiles VALUES (pg_temp.u(100), pg_temp.u(2));
INSERT INTO public.courses VALUES (pg_temp.u(101), pg_temp.u(9));
INSERT INTO public.coach_ratings VALUES
    (pg_temp.u(102), pg_temp.u(6), NULL),
    (pg_temp.u(103), pg_temp.u(7), 'Foarte bun'),
    (pg_temp.u(104), pg_temp.u(10), '   ');
INSERT INTO public.course_ratings VALUES (pg_temp.u(105), pg_temp.u(8), 'Recomand');

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id, name, role, avatar_url) ON public.profiles TO anon, authenticated;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO anon, authenticated USING (true);

\i /tmp/migrations/00135_restrict_anon_profiles.sql

SET LOCAL ROLE anon;
DO $$
DECLARE
    v_names TEXT;
BEGIN
    SELECT string_agg(name, ' | ' ORDER BY id) INTO v_names FROM public.profiles;
    IF v_names IS DISTINCT FROM 'Admin antrenor | Antrenor | Club | Părinte cu comentariu antrenor | Părinte cu comentariu curs | Admin curs' THEN
        RAISE EXCEPTION 'anon sees unexpected profiles: %', v_names;
    END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
BEGIN
    IF (SELECT count(*) FROM public.profiles) <> 10 THEN
        RAISE EXCEPTION 'authenticated lost profile visibility';
    END IF;
END $$;
RESET ROLE;

DO $$
BEGIN
    IF has_function_privilege('public', 'public.is_public_profile(uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'is_public_profile must not be executable by PUBLIC';
    END IF;
END $$;

SELECT 'restrict-anon-profiles: ok' AS result;
ROLLBACK;
