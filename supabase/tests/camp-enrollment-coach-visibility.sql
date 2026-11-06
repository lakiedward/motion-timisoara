\set ON_ERROR_STOP on
BEGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE public.profiles(id UUID PRIMARY KEY, role TEXT NOT NULL);
CREATE TABLE public.clubs(id UUID PRIMARY KEY, owner_user_id UUID);
CREATE TABLE public.courses(id UUID PRIMARY KEY, coach_id UUID, club_id UUID);
CREATE TABLE public.activities(id UUID PRIMARY KEY, coach_id UUID);
CREATE TABLE public.camps(id UUID PRIMARY KEY, club_id UUID, coach_id UUID);
CREATE TABLE public.coach_profiles(id UUID PRIMARY KEY, user_id UUID NOT NULL);
CREATE TABLE public.camp_coaches(camp_id UUID NOT NULL REFERENCES public.camps(id),
    coach_profile_id UUID NOT NULL REFERENCES public.coach_profiles(id),
    status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
    PRIMARY KEY (camp_id, coach_profile_id));
CREATE TABLE public.children(id UUID PRIMARY KEY, parent_id UUID NOT NULL, name TEXT NOT NULL, allergies TEXT);
CREATE TABLE public.enrollments(id UUID PRIMARY KEY, kind TEXT NOT NULL, entity_id UUID NOT NULL,
    child_id UUID REFERENCES public.children(id), status TEXT NOT NULL);
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
CREATE FUNCTION public.my_club_ids() RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT id FROM public.clubs WHERE owner_user_id = auth.uid()
$$;
CREATE FUNCTION public.coach_enrolled_child_ids() RETURNS SETOF UUID LANGUAGE sql STABLE AS $$
    SELECT NULL::UUID WHERE false
$$;
CREATE FUNCTION public.club_enrolled_child_ids() RETURNS SETOF UUID LANGUAGE sql STABLE AS $$
    SELECT NULL::UUID WHERE false
$$;
CREATE FUNCTION public.pot_administra_tabara(p_camp_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.camps c
        WHERE c.id = p_camp_id
          AND (
              c.club_id IN (SELECT my_club_ids())
              OR c.coach_id = (SELECT auth.uid())
          )
    ) OR (SELECT get_my_role()) = 'ADMIN'
$$;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
\i /tmp/migrations/00028_camp_enrollments_and_orphan_photos.sql
\i /tmp/migrations/00032_camp_enrolled_children.sql

CREATE FUNCTION public.test_uuid(v INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-0000-0000-' || lpad(v::TEXT, 12, '0'))::UUID
$$;
INSERT INTO public.profiles(id, role) VALUES
    (public.test_uuid(1), 'ADMIN'), (public.test_uuid(2), 'CLUB'), (public.test_uuid(3), 'COACH'),
    (public.test_uuid(4), 'COACH'), (public.test_uuid(5), 'COACH'), (public.test_uuid(6), 'COACH'),
    (public.test_uuid(7), 'COACH'), (public.test_uuid(8), 'PARENT');
INSERT INTO public.clubs(id, owner_user_id) VALUES (public.test_uuid(100), public.test_uuid(2));
INSERT INTO public.camps(id, club_id, coach_id) VALUES
    (public.test_uuid(200), public.test_uuid(100), NULL),
    (public.test_uuid(201), NULL, public.test_uuid(3));
INSERT INTO public.coach_profiles(id, user_id) VALUES
    (public.test_uuid(304), public.test_uuid(4)), (public.test_uuid(305), public.test_uuid(5)),
    (public.test_uuid(306), public.test_uuid(6)), (public.test_uuid(307), public.test_uuid(7));
INSERT INTO public.camp_coaches(camp_id, coach_profile_id, status) VALUES
    (public.test_uuid(200), public.test_uuid(304), 'accepted'),
    (public.test_uuid(200), public.test_uuid(305), 'invited'),
    (public.test_uuid(200), public.test_uuid(306), 'declined');
INSERT INTO public.children(id, parent_id, name, allergies) VALUES
    (public.test_uuid(400), public.test_uuid(8), 'Copil tabără club', 'arahide'),
    (public.test_uuid(401), public.test_uuid(8), 'Copil tabără antrenor', NULL);
INSERT INTO public.enrollments(id, kind, entity_id, child_id, status) VALUES
    (public.test_uuid(500), 'CAMP', public.test_uuid(200), public.test_uuid(400), 'ACTIVE'),
    (public.test_uuid(501), 'CAMP', public.test_uuid(201), public.test_uuid(401), 'PENDING');

CREATE TEMP TABLE visibility(phase TEXT, actor TEXT, camp_enrollments INTEGER, camp_children INTEGER);
GRANT ALL ON visibility TO authenticated;
CREATE FUNCTION pg_temp.observe(p_phase TEXT, p_actor TEXT, p_user INTEGER) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('request.jwt.claim.sub', public.test_uuid(p_user)::TEXT, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO visibility VALUES (p_phase, p_actor,
        (SELECT count(*) FROM public.enrollments WHERE entity_id = public.test_uuid(200)),
        (SELECT count(*) FROM public.children WHERE id = public.test_uuid(400)));
    RESET ROLE;
END
$$;

SELECT pg_temp.observe('before', 'invited coach', 5);
SELECT pg_temp.observe('before', 'declined coach', 6);
DO $$
BEGIN
    IF (SELECT sum(camp_enrollments + camp_children) FROM visibility WHERE phase = 'before') <> 4 THEN
        RAISE EXCEPTION 'Testul nu mai reproduce bug-ul #1363 pe sursa din 00028.';
    END IF;
END
$$;

\i /tmp/migrations/00126_camp_enrollments_accepted_coaches.sql

SELECT pg_temp.observe('after', 'admin', 1);
SELECT pg_temp.observe('after', 'club owner', 2);
SELECT pg_temp.observe('after', 'accepted coach', 4);
SELECT pg_temp.observe('after', 'invited coach', 5);
SELECT pg_temp.observe('after', 'declined coach', 6);
SELECT pg_temp.observe('after', 'stranger coach', 7);
SELECT pg_temp.observe('after', 'parent', 8);
SELECT * FROM visibility ORDER BY phase DESC, actor;

DO $$
DECLARE
    v_expected JSONB := jsonb_build_object(
        'admin', 1, 'club owner', 1, 'accepted coach', 1, 'parent', 1,
        'invited coach', 0, 'declined coach', 0, 'stranger coach', 0);
    v_row RECORD;
BEGIN
    FOR v_row IN SELECT * FROM visibility WHERE phase = 'after' LOOP
        IF v_row.camp_enrollments <> (v_expected->>v_row.actor)::INTEGER
           OR v_row.camp_children <> (v_expected->>v_row.actor)::INTEGER THEN
            RAISE EXCEPTION 'Vizibilitate greșită pentru %: % înscrieri, % copii', v_row.actor,
                v_row.camp_enrollments, v_row.camp_children;
        END IF;
    END LOOP;
END
$$;

DO $$
BEGIN
    PERFORM set_config('request.jwt.claim.sub', public.test_uuid(3)::TEXT, true);
    IF NOT public.pot_vedea_inscrierile_taberei(public.test_uuid(201)) THEN
        RAISE EXCEPTION 'Antrenorul care a creat tabăra trebuie să-i vadă înscrierile.';
    END IF;
    IF public.pot_vedea_inscrierile_taberei(public.test_uuid(200)) THEN
        RAISE EXCEPTION 'Antrenorul altei tabere nu trebuie să vadă înscrierile.';
    END IF;
END
$$;

DO $$
BEGIN
    BEGIN
        EXECUTE pg_read_file('/tmp/migrations/00126_camp_enrollments_accepted_coaches.sql');
        RAISE EXCEPTION 'guard-missed';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM = 'guard-missed' THEN
            RAISE EXCEPTION 'Migrația 00126 trebuie să refuze o funcție schimbată de altă migrație.';
        END IF;
    END;
END
$$;

ROLLBACK;
\echo 'camp enrollment coach visibility: ok'
