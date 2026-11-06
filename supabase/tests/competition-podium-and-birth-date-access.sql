\set ON_ERROR_STOP on
BEGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE public.profiles(id UUID PRIMARY KEY, role TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true, deleted_at TIMESTAMPTZ);
CREATE TABLE public.clubs(id UUID PRIMARY KEY, owner_user_id UUID);
CREATE TABLE public.coach_profiles(id UUID PRIMARY KEY, user_id UUID NOT NULL);
CREATE TABLE public.competitions(id UUID PRIMARY KEY, coach_id UUID, club_id UUID,
    end_at TIMESTAMPTZ NOT NULL);
CREATE TABLE public.competition_coaches(competition_id UUID NOT NULL, coach_profile_id UUID NOT NULL,
    status TEXT NOT NULL);
CREATE TABLE public.competition_age_categories(id UUID PRIMARY KEY, competition_id UUID NOT NULL);
CREATE TABLE public.children(id UUID PRIMARY KEY, parent_id UUID NOT NULL);
CREATE TABLE public.enrollments(id UUID PRIMARY KEY, child_id UUID, adult_profile_id UUID);
CREATE TABLE public.competition_registrations(
    id UUID PRIMARY KEY, enrollment_id UUID NOT NULL, competition_id UUID NOT NULL,
    category_id UUID NOT NULL, route_id UUID, category_name_snapshot TEXT NOT NULL,
    route_name_snapshot TEXT, gpx_storage_path_snapshot TEXT, adult_profile_id UUID,
    adult_birth_date DATE, age_at_registration INTEGER NOT NULL, accepted_price_bani BIGINT NOT NULL,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE public.competition_podium_publications(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL, category_id UUID NOT NULL UNIQUE);
CREATE TABLE public.competition_podium_results(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL, category_id UUID NOT NULL, registration_id UUID NOT NULL,
    place INTEGER NOT NULL CHECK (place BETWEEN 1 AND 3), UNIQUE (category_id, place));

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE FUNCTION public.test_uuid(p_n INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-0000-0000-' || lpad(p_n::TEXT, 12, '0'))::UUID
$$;
CREATE FUNCTION public.my_club_ids() RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT id FROM public.clubs WHERE owner_user_id = auth.uid()
$$;
CREATE FUNCTION public.my_child_ids() RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT id FROM public.children WHERE parent_id = auth.uid();
$$;
CREATE FUNCTION public.get_my_role() RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() AND enabled AND deleted_at IS NULL;
$$;
CREATE FUNCTION public.pot_administra_concurs(p_competition_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.competitions c
        WHERE c.id = p_competition_id
          AND (c.club_id IN (SELECT public.my_club_ids()) OR c.coach_id = (SELECT auth.uid()))
    ) OR (SELECT public.get_my_role()) = 'ADMIN'
$$;
CREATE FUNCTION public.can_view_competition_registrations(p_competition_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.competitions c
        WHERE c.id = p_competition_id
          AND (
              public.pot_administra_concurs(c.id)
              OR EXISTS (
                  SELECT 1 FROM public.competition_coaches cc
                  JOIN public.coach_profiles cp ON cp.id = cc.coach_profile_id
                  WHERE cc.competition_id = c.id
                    AND cc.status = 'accepted'
                    AND cp.user_id = (SELECT auth.uid())
              )
          )
    )
$$;
DO $do$
BEGIN
    EXECUTE 'CREATE FUNCTION public.can_edit_competition_podium(p_competition_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '''' AS $f$'
        || replace($body$
    SELECT EXISTS (
        SELECT 1 FROM public.competitions c
        WHERE c.id = p_competition_id
          AND c.end_at <= now()
          AND public.can_view_competition_registrations(c.id)
    )
$body$, E'\n', E'\r\n') || '$f$';
END
$do$;

ALTER TABLE public.competition_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.competition_registrations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.competition_registrations TO authenticated, service_role;
GRANT SELECT ON public.enrollments, public.children TO authenticated;
CREATE POLICY competition_registrations_select ON public.competition_registrations
    FOR SELECT TO authenticated
    USING (
        enrollment_id IN (
            SELECT e.id FROM public.enrollments e
            WHERE e.child_id IN (SELECT public.my_child_ids())
               OR e.adult_profile_id = (SELECT auth.uid())
        )
        OR public.can_view_competition_registrations(competition_id)
    );

ALTER TABLE public.competition_podium_publications ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.competition_podium_publications TO authenticated;
CREATE POLICY competition_podium_publications_select ON public.competition_podium_publications
    FOR SELECT TO anon, authenticated USING (TRUE);

ALTER TABLE public.competition_podium_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.competition_podium_results FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.competition_podium_results TO authenticated;
GRANT INSERT (competition_id, category_id, registration_id, place)
    ON public.competition_podium_results TO authenticated;
GRANT UPDATE (registration_id, place) ON public.competition_podium_results TO authenticated;
GRANT DELETE ON public.competition_podium_results TO authenticated;
CREATE POLICY competition_podium_results_staff_select ON public.competition_podium_results
    FOR SELECT TO authenticated
    USING (public.can_view_competition_registrations(competition_id));
CREATE POLICY competition_podium_results_insert ON public.competition_podium_results
    FOR INSERT TO authenticated
    WITH CHECK (public.can_edit_competition_podium(competition_id));
CREATE POLICY competition_podium_results_update ON public.competition_podium_results
    FOR UPDATE TO authenticated
    USING (public.can_edit_competition_podium(competition_id))
    WITH CHECK (public.can_edit_competition_podium(competition_id));
CREATE POLICY competition_podium_results_delete ON public.competition_podium_results
    FOR DELETE TO authenticated
    USING (public.can_edit_competition_podium(competition_id));

INSERT INTO public.profiles(id, role, enabled) VALUES
    (public.test_uuid(1), 'ADMIN', true),
    (public.test_uuid(2), 'COACH', true),
    (public.test_uuid(3), 'COACH', true),
    (public.test_uuid(4), 'COACH', true),
    (public.test_uuid(5), 'PARENT', true),
    (public.test_uuid(6), 'PARENT', true);
INSERT INTO public.coach_profiles VALUES (public.test_uuid(30), public.test_uuid(3)),
    (public.test_uuid(40), public.test_uuid(4));
INSERT INTO public.competitions VALUES (public.test_uuid(100), public.test_uuid(2), NULL, now() - interval '1 day');
INSERT INTO public.competition_coaches VALUES (public.test_uuid(100), public.test_uuid(30), 'accepted'),
    (public.test_uuid(100), public.test_uuid(40), 'declined');
INSERT INTO public.competition_age_categories VALUES (public.test_uuid(110), public.test_uuid(100)),
    (public.test_uuid(111), public.test_uuid(100));
INSERT INTO public.children VALUES (public.test_uuid(200), public.test_uuid(5));
INSERT INTO public.enrollments VALUES (public.test_uuid(300), public.test_uuid(200), NULL),
    (public.test_uuid(301), NULL, public.test_uuid(6));
INSERT INTO public.competition_registrations(id, enrollment_id, competition_id, category_id,
        category_name_snapshot, adult_profile_id, adult_birth_date, age_at_registration, accepted_price_bani)
VALUES
    (public.test_uuid(400), public.test_uuid(300), public.test_uuid(100), public.test_uuid(110), 'Copii', NULL, NULL, 10, 5000),
    (public.test_uuid(401), public.test_uuid(301), public.test_uuid(100), public.test_uuid(110), 'Copii', public.test_uuid(6), '1990-05-17', 36, 5000),
    (public.test_uuid(402), public.test_uuid(300), public.test_uuid(100), public.test_uuid(111), 'Adulți', NULL, NULL, 10, 5000);
INSERT INTO public.competition_podium_results(competition_id, category_id, registration_id, place) VALUES
    (public.test_uuid(100), public.test_uuid(110), public.test_uuid(400), 1),
    (public.test_uuid(100), public.test_uuid(111), public.test_uuid(402), 1);
INSERT INTO public.competition_podium_publications(competition_id, category_id)
VALUES (public.test_uuid(100), public.test_uuid(110));

CREATE TEMP TABLE probes(phase TEXT, actor TEXT, category TEXT, inserted INTEGER, updated INTEGER,
    deleted INTEGER, birth_dates TEXT, registrations INTEGER);
GRANT ALL ON probes TO authenticated;

CREATE FUNCTION pg_temp.probe(p_phase TEXT, p_actor TEXT, p_user INTEGER, p_category INTEGER)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_inserted INTEGER := 0;
    v_updated INTEGER := 0;
    v_deleted INTEGER := 0;
    v_birth_dates TEXT;
    v_registrations INTEGER;
BEGIN
    BEGIN
        PERFORM set_config('request.jwt.claim.sub', public.test_uuid(p_user)::TEXT, true);
        SET LOCAL ROLE authenticated;
        BEGIN
            INSERT INTO public.competition_podium_results(competition_id, category_id, registration_id, place)
            VALUES (public.test_uuid(100), public.test_uuid(p_category),
                CASE p_category WHEN 110 THEN public.test_uuid(401) ELSE public.test_uuid(402) END, 3);
            v_inserted := 1;
        EXCEPTION WHEN insufficient_privilege THEN v_inserted := 0;
        END;
        UPDATE public.competition_podium_results SET place = 2
        WHERE category_id = public.test_uuid(p_category) AND place = 1;
        GET DIAGNOSTICS v_updated = ROW_COUNT;
        DELETE FROM public.competition_podium_results WHERE category_id = public.test_uuid(p_category);
        GET DIAGNOSTICS v_deleted = ROW_COUNT;
        BEGIN
            SELECT count(adult_birth_date)::TEXT INTO v_birth_dates FROM public.competition_registrations;
        EXCEPTION WHEN insufficient_privilege THEN v_birth_dates := 'denied';
        END;
        SELECT count(*) INTO v_registrations FROM (
            SELECT id, enrollment_id, competition_id, category_id, route_id, category_name_snapshot,
                route_name_snapshot, gpx_storage_path_snapshot, adult_profile_id, age_at_registration,
                accepted_price_bani, registered_at
            FROM public.competition_registrations) visible;
        RAISE EXCEPTION 'probe-rollback';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'probe-rollback' THEN RAISE; END IF;
    END;
    INSERT INTO probes VALUES (p_phase, p_actor, CASE p_category WHEN 110 THEN 'published' ELSE 'private' END,
        v_inserted, v_updated, v_deleted, v_birth_dates, v_registrations);
END
$$;

CREATE FUNCTION pg_temp.observe(p_phase TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_temp.probe(p_phase, 'organizer', 2, 110);
    PERFORM pg_temp.probe(p_phase, 'organizer', 2, 111);
    PERFORM pg_temp.probe(p_phase, 'admin', 1, 110);
    PERFORM pg_temp.probe(p_phase, 'invited coach', 3, 110);
    PERFORM pg_temp.probe(p_phase, 'invited coach', 3, 111);
    PERFORM pg_temp.probe(p_phase, 'declined coach', 4, 110);
    PERFORM pg_temp.probe(p_phase, 'declined coach', 4, 111);
    PERFORM pg_temp.probe(p_phase, 'adult enrollee', 6, 111);
END
$$;

SELECT pg_temp.observe('before');

DO $$
BEGIN
    IF (SELECT updated FROM probes WHERE phase = 'before' AND actor = 'invited coach' AND category = 'published') <> 1
       OR (SELECT birth_dates FROM probes WHERE phase = 'before' AND actor = 'invited coach' AND category = 'published') <> '1' THEN
        RAISE EXCEPTION 'Testul nu reproduce bug-urile #1368/#1369 înainte de 00133.';
    END IF;
END
$$;

\i /tmp/migrations/00133_competition_podium_and_birth_date_access.sql

SELECT pg_temp.observe('after');
SELECT * FROM probes ORDER BY phase DESC, actor, category;

DO $$
DECLARE
    v_expected JSONB := jsonb_build_object(
        'organizer/published', '1/1/2/denied/3',
        'organizer/private', '1/1/2/denied/3',
        'admin/published', '1/1/2/denied/3',
        'invited coach/published', '0/0/0/denied/3',
        'invited coach/private', '1/1/2/denied/3',
        'declined coach/published', '0/0/0/denied/0',
        'declined coach/private', '0/0/0/denied/0',
        'adult enrollee/private', '0/0/0/denied/1');
    v_row RECORD;
    v_actual TEXT;
BEGIN
    FOR v_row IN SELECT * FROM probes WHERE phase = 'after' LOOP
        v_actual := concat_ws('/', v_row.inserted, v_row.updated, v_row.deleted, v_row.birth_dates, v_row.registrations);
        IF v_actual IS DISTINCT FROM v_expected->>(v_row.actor || '/' || v_row.category) THEN
            RAISE EXCEPTION 'Acces greșit pentru % pe categoria %: % (așteptat %)',
                v_row.actor, v_row.category, v_actual, v_expected->>(v_row.actor || '/' || v_row.category);
        END IF;
    END LOOP;
    IF (SELECT count(adult_birth_date) FROM public.competition_registrations) <> 1 THEN
        RAISE EXCEPTION 'Data nașterii trebuie să rămână în tabel pentru service_role.';
    END IF;
END
$$;

SET LOCAL ROLE service_role;
SELECT count(adult_birth_date) AS service_role_birth_dates FROM public.competition_registrations;
RESET ROLE;

DO $$
BEGIN
    BEGIN
        EXECUTE pg_read_file('/tmp/migrations/00133_competition_podium_and_birth_date_access.sql');
        RAISE EXCEPTION 'guard-missed';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM = 'guard-missed' THEN
            RAISE EXCEPTION 'Migrația 00133 trebuie să refuze politici sau granturi schimbate între timp.';
        END IF;
    END;
END
$$;

ROLLBACK;
\echo 'competition podium and birth date access: ok'
