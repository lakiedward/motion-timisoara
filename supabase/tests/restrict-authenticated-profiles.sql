\set ON_ERROR_STOP on
BEGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
CREATE TABLE public.profiles(id UUID PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, avatar_url TEXT);
CREATE TABLE public.coach_profiles(id UUID PRIMARY KEY, user_id UUID NOT NULL);
CREATE TABLE public.clubs(id UUID PRIMARY KEY, owner_user_id UUID);
CREATE TABLE public.courses(id UUID PRIMARY KEY, coach_id UUID, club_id UUID);
CREATE TABLE public.activities(id UUID PRIMARY KEY, coach_id UUID);
CREATE TABLE public.camps(id UUID PRIMARY KEY, coach_id UUID);
CREATE TABLE public.competitions(id UUID PRIMARY KEY, coach_id UUID);
CREATE TABLE public.coach_ratings(id UUID PRIMARY KEY, parent_id UUID NOT NULL, comment TEXT);
CREATE TABLE public.course_ratings(id UUID PRIMARY KEY, parent_id UUID NOT NULL, comment TEXT);
CREATE TABLE public.children(id UUID PRIMARY KEY, parent_id UUID NOT NULL);
CREATE TABLE public.enrollments(id UUID PRIMARY KEY, kind TEXT NOT NULL, entity_id UUID NOT NULL,
    child_id UUID, adult_profile_id UUID, status TEXT NOT NULL);
CREATE TABLE public.course_announcements(id UUID PRIMARY KEY, course_id UUID NOT NULL, author_user_id UUID NOT NULL);

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE FUNCTION public.get_my_role() RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid()
$$;
CREATE FUNCTION public.my_child_ids() RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT id FROM public.children WHERE parent_id = auth.uid()
$$;
CREATE FUNCTION public.pot_vedea_inscrierile_taberei(p_camp_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.camps c WHERE c.id = p_camp_id AND c.coach_id = auth.uid())
$$;
CREATE FUNCTION public.can_view_competition_registrations(p_competition_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.competitions c WHERE c.id = p_competition_id AND c.coach_id = auth.uid())
$$;

ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY children_select ON public.children FOR SELECT TO authenticated
    USING (parent_id = (SELECT auth.uid()));
CREATE POLICY enrollments_select ON public.enrollments FOR SELECT TO authenticated USING (
    child_id IN (SELECT public.my_child_ids())
    OR adult_profile_id = (SELECT auth.uid())
    OR ((SELECT public.get_my_role()) IS NOT NULL AND (
        (kind = 'COURSE' AND entity_id IN (SELECT co.id FROM public.courses co WHERE co.coach_id = (SELECT auth.uid())))
        OR (kind = 'ACTIVITY' AND entity_id IN (SELECT a.id FROM public.activities a WHERE a.coach_id = (SELECT auth.uid())))
        OR (kind = 'COURSE' AND entity_id IN (SELECT c.id FROM public.courses c JOIN public.clubs cl ON c.club_id = cl.id
            WHERE cl.owner_user_id = (SELECT auth.uid())))))
    OR (kind = 'CAMP' AND public.pot_vedea_inscrierile_taberei(entity_id))
    OR (SELECT public.get_my_role()) = 'ADMIN');
CREATE POLICY enrollments_competition_staff_select ON public.enrollments FOR SELECT TO authenticated
    USING (kind = 'COMPETITION' AND public.can_view_competition_registrations(entity_id));
CREATE POLICY course_announcements_select ON public.course_announcements FOR SELECT TO authenticated USING (
    course_id IN (SELECT e.entity_id FROM public.enrollments e JOIN public.children c ON e.child_id = c.id
        WHERE c.parent_id = (SELECT auth.uid()) AND e.kind = 'COURSE' AND e.status = 'ACTIVE')
    OR course_id IN (SELECT courses.id FROM public.courses WHERE courses.coach_id = (SELECT auth.uid()))
    OR (SELECT public.get_my_role()) = 'ADMIN');
GRANT SELECT ON public.children, public.enrollments, public.course_announcements, public.courses,
    public.activities, public.clubs, public.camps, public.competitions TO authenticated;

CREATE FUNCTION public.test_uuid(p_n INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-0000-0000-' || lpad(p_n::TEXT, 12, '0'))::UUID
$$;

INSERT INTO public.profiles(id, name, role) VALUES
    (public.test_uuid(1), 'Admin ascuns', 'ADMIN'),
    (public.test_uuid(2), 'Antrenor curs', 'COACH'),
    (public.test_uuid(3), 'Antrenor tabără', 'COACH'),
    (public.test_uuid(4), 'Club', 'CLUB'),
    (public.test_uuid(5), 'Părinte nou', 'PARENT'),
    (public.test_uuid(6), 'Părinte cu copil înscris', 'PARENT'),
    (public.test_uuid(7), 'Adult înscris la curs', 'PARENT'),
    (public.test_uuid(8), 'Părinte cu recenzie', 'PARENT'),
    (public.test_uuid(9), 'Admin autor anunț', 'ADMIN'),
    (public.test_uuid(10), 'Adult înscris la tabără', 'PARENT'),
    (public.test_uuid(11), 'Adult înscris la concurs', 'PARENT');
INSERT INTO public.clubs VALUES (public.test_uuid(200), public.test_uuid(4));
INSERT INTO public.courses VALUES (public.test_uuid(101), public.test_uuid(2), NULL), (public.test_uuid(102), NULL, public.test_uuid(200));
INSERT INTO public.camps VALUES (public.test_uuid(400), public.test_uuid(3));
INSERT INTO public.competitions VALUES (public.test_uuid(500), public.test_uuid(3));
INSERT INTO public.coach_ratings VALUES (public.test_uuid(600), public.test_uuid(8), 'Foarte bun');
INSERT INTO public.children VALUES (public.test_uuid(300), public.test_uuid(6));
INSERT INTO public.enrollments VALUES
    (public.test_uuid(700), 'COURSE', public.test_uuid(101), public.test_uuid(300), NULL, 'ACTIVE'),
    (public.test_uuid(701), 'COURSE', public.test_uuid(101), NULL, public.test_uuid(7), 'ACTIVE'),
    (public.test_uuid(702), 'CAMP', public.test_uuid(400), NULL, public.test_uuid(10), 'ACTIVE'),
    (public.test_uuid(703), 'COMPETITION', public.test_uuid(500), NULL, public.test_uuid(11), 'ACTIVE');
INSERT INTO public.course_announcements VALUES (public.test_uuid(800), public.test_uuid(101), public.test_uuid(9));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id, name, role, avatar_url) ON public.profiles TO anon, authenticated;
GRANT UPDATE (name) ON public.profiles TO authenticated;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid()) OR (SELECT public.get_my_role()) = 'ADMIN')
    WITH CHECK (id = (SELECT auth.uid()) OR (SELECT public.get_my_role()) = 'ADMIN');

\i /tmp/migrations/00135_restrict_anon_profiles.sql
\i /tmp/migrations/00140_restrict_authenticated_profiles.sql

CREATE FUNCTION public.test_visible_ids() RETURNS TEXT LANGUAGE sql STABLE AS $$
    SELECT coalesce(string_agg(right(id::TEXT, 2), ',' ORDER BY id), '') FROM public.profiles
$$;

CREATE FUNCTION public.test_expect(p_actor INTEGER, p_expected TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_seen TEXT;
BEGIN
    PERFORM set_config('request.jwt.claim.sub', CASE WHEN p_actor IS NULL THEN '' ELSE public.test_uuid(p_actor)::TEXT END, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_seen := public.test_visible_ids();
    EXECUTE 'RESET ROLE';
    IF v_seen IS DISTINCT FROM p_expected THEN
        RAISE EXCEPTION 'actor % sees profiles [%], expected [%]', p_actor, v_seen, p_expected;
    END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.test_visible_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_uuid(INTEGER) TO authenticated;

SELECT public.test_expect(1, '01,02,03,04,05,06,07,08,09,10,11');
SELECT public.test_expect(2, '02,03,04,07,08,09');
SELECT public.test_expect(3, '02,03,04,08,10,11');
SELECT public.test_expect(4, '02,03,04,08');
SELECT public.test_expect(5, '02,03,04,05,08');
SELECT public.test_expect(6, '02,03,04,06,08,09');
SELECT public.test_expect(7, '02,03,04,07,08');
SELECT public.test_expect(99, '02,03,04,08');
SELECT public.test_expect(NULL, '02,03,04,08');

UPDATE public.courses SET club_id = public.test_uuid(200) WHERE id = public.test_uuid(101);
SELECT public.test_expect(4, '02,03,04,07,08');
UPDATE public.courses SET club_id = NULL WHERE id = public.test_uuid(101);

SET LOCAL ROLE anon;
DO $$
BEGIN
    IF (SELECT string_agg(right(id::TEXT, 2), ',' ORDER BY id) FROM public.profiles) IS DISTINCT FROM '02,03,04,08' THEN
        RAISE EXCEPTION 'anon visibility changed';
    END IF;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', public.test_uuid(5)::TEXT, true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
    v_rows INTEGER;
BEGIN
    UPDATE public.profiles SET name = 'Părinte nou redenumit' WHERE id = auth.uid();
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'own profile update affected % rows', v_rows;
    END IF;
    UPDATE public.profiles SET name = 'x' WHERE id = '00000000-0000-0000-0000-000000000002';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 0 THEN
        RAISE EXCEPTION 'foreign profile update affected % rows', v_rows;
    END IF;
END $$;
RESET ROLE;

DO $$
BEGIN
    IF (SELECT count(*) FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_select'
            AND roles = '{authenticated}'::name[]) <> 1 THEN
        RAISE EXCEPTION 'profiles_select must target authenticated only';
    END IF;
    IF (SELECT count(*) FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'SELECT') <> 2 THEN
        RAISE EXCEPTION 'unexpected SELECT policies on profiles';
    END IF;
END $$;

SELECT 'restrict-authenticated-profiles: ok' AS result;
ROLLBACK;
