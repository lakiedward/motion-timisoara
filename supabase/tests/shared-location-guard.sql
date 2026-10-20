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
    name TEXT NOT NULL,
    role TEXT NOT NULL
);
CREATE TABLE public.clubs (
    id UUID PRIMARY KEY,
    owner_user_id UUID REFERENCES public.profiles(id),
    name TEXT NOT NULL
);

CREATE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid()
$$;
CREATE FUNCTION public.my_club_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT id FROM public.clubs WHERE owner_user_id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_club_ids() TO anon, authenticated;

CREATE TABLE public.locations (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    county TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
    created_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE TABLE public.courses (
    id UUID PRIMARY KEY,
    club_id UUID REFERENCES public.clubs(id),
    coach_id UUID REFERENCES public.profiles(id),
    location_id UUID NOT NULL REFERENCES public.locations(id)
);
CREATE TABLE public.activities (
    id UUID PRIMARY KEY,
    club_id UUID REFERENCES public.clubs(id),
    coach_id UUID REFERENCES public.profiles(id),
    location_id UUID NOT NULL REFERENCES public.locations(id)
);
CREATE TABLE public.camps (
    id UUID PRIMARY KEY,
    club_id UUID REFERENCES public.clubs(id),
    coach_id UUID REFERENCES public.profiles(id),
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL
);
CREATE TABLE public.competitions (
    id UUID PRIMARY KEY,
    club_id UUID REFERENCES public.clubs(id),
    coach_id UUID REFERENCES public.profiles(id),
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL
);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "locations_select" ON public.locations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "locations_update" ON public.locations
  FOR UPDATE TO authenticated
  USING (
    created_by_user_id = (select auth.uid())
    OR club_id IN (SELECT public.my_club_ids())
    OR (select public.get_my_role()) = 'ADMIN'
  )
  WITH CHECK (
    created_by_user_id = (select auth.uid())
    OR club_id IN (SELECT public.my_club_ids())
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "locations_delete" ON public.locations
  FOR DELETE TO authenticated
  USING (
    created_by_user_id = (select auth.uid())
    OR club_id IN (SELECT public.my_club_ids())
    OR (select public.get_my_role()) = 'ADMIN'
  );
GRANT SELECT, UPDATE, DELETE ON public.locations TO authenticated;

\i /tmp/migrations/00098_shared_location_guard.sql

INSERT INTO public.profiles (id, name, role) VALUES
    ('00000000-0000-0000-0000-0000000000a1', 'Admin', 'ADMIN'),
    ('00000000-0000-0000-0000-0000000000c1', 'Proprietar Club', 'CLUB'),
    ('00000000-0000-0000-0000-0000000000d1', 'Antrenor Club', 'COACH'),
    ('00000000-0000-0000-0000-0000000000e1', 'Antrenor Independent', 'COACH'),
    ('00000000-0000-0000-0000-0000000000e2', 'Alt Antrenor', 'COACH');
INSERT INTO public.clubs (id, owner_user_id, name) VALUES
    ('00000000-0000-0000-0000-00000000c100', '00000000-0000-0000-0000-0000000000c1', 'Club Unu');

INSERT INTO public.locations (id, name, address, lat, lng, club_id, created_by_user_id) VALUES
    ('00000000-0000-0000-0000-000000000101', 'Bazin Club Partajat', 'Str. A 1', 45.7, 21.2, '00000000-0000-0000-0000-00000000c100', '00000000-0000-0000-0000-0000000000c1'),
    ('00000000-0000-0000-0000-000000000102', 'Bazin Doar Club', 'Str. B 2', 45.7, 21.2, '00000000-0000-0000-0000-00000000c100', '00000000-0000-0000-0000-0000000000c1'),
    ('00000000-0000-0000-0000-000000000103', 'Sala Antrenor', 'Str. C 3', 45.7, 21.2, NULL, '00000000-0000-0000-0000-0000000000e1'),
    ('00000000-0000-0000-0000-000000000104', 'Teren Tabără', 'Str. D 4', 45.7, 21.2, NULL, '00000000-0000-0000-0000-0000000000e1'),
    ('00000000-0000-0000-0000-000000000105', 'Pistă Concurs', 'Str. E 5', 45.7, 21.2, '00000000-0000-0000-0000-00000000c100', '00000000-0000-0000-0000-0000000000c1');

INSERT INTO public.courses (id, club_id, coach_id, location_id) VALUES
    ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-00000000c100', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000101'),
    ('00000000-0000-0000-0000-000000000202', NULL, '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000101'),
    ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-00000000c100', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000102'),
    ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-00000000c100', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000103');
INSERT INTO public.activities (id, club_id, coach_id, location_id) VALUES
    ('00000000-0000-0000-0000-000000000301', NULL, '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000103');
INSERT INTO public.camps (id, club_id, coach_id, location_id) VALUES
    ('00000000-0000-0000-0000-000000000401', NULL, '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000104');
INSERT INTO public.competitions (id, club_id, coach_id, location_id) VALUES
    ('00000000-0000-0000-0000-000000000501', NULL, '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000105');

CREATE FUNCTION pg_temp.expect_guard(p_sql text, p_expected_names text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_message text;
    v_hint text;
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN raise_exception THEN
        GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT, v_hint = PG_EXCEPTION_HINT;
        IF v_hint IS DISTINCT FROM 'shared_location_guard' THEN
            RAISE EXCEPTION 'Wrong hint % for: %', v_hint, p_sql;
        END IF;
        IF position(p_expected_names IN v_message) = 0 THEN
            RAISE EXCEPTION 'Message "%" does not name "%"', v_message, p_expected_names;
        END IF;
        RETURN;
    END;
    RAISE EXCEPTION 'Guard did not block: %', p_sql;
END;
$$;
GRANT EXECUTE ON FUNCTION pg_temp.expect_guard(text, text) TO authenticated;

SET LOCAL ROLE authenticated;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
DO $$
DECLARE
    v_rows integer;
BEGIN
    PERFORM pg_temp.expect_guard($q$UPDATE public.locations SET is_active = false WHERE id = '00000000-0000-0000-0000-000000000101'$q$, 'Antrenor Independent');
    PERFORM pg_temp.expect_guard($q$UPDATE public.locations SET address = 'Str. Nouă 9' WHERE id = '00000000-0000-0000-0000-000000000101'$q$, 'Antrenor Independent');
    PERFORM pg_temp.expect_guard($q$UPDATE public.locations SET city = 'Arad' WHERE id = '00000000-0000-0000-0000-000000000101'$q$, 'Antrenor Independent');
    PERFORM pg_temp.expect_guard($q$UPDATE public.locations SET county = 'Arad' WHERE id = '00000000-0000-0000-0000-000000000101'$q$, 'Antrenor Independent');
    PERFORM pg_temp.expect_guard($q$UPDATE public.locations SET lat = 45.8 WHERE id = '00000000-0000-0000-0000-000000000101'$q$, 'Antrenor Independent');
    PERFORM pg_temp.expect_guard($q$UPDATE public.locations SET lng = 21.3 WHERE id = '00000000-0000-0000-0000-000000000101'$q$, 'Antrenor Independent');
    PERFORM pg_temp.expect_guard($q$DELETE FROM public.locations WHERE id = '00000000-0000-0000-0000-000000000101'$q$, 'Antrenor Independent');
    PERFORM pg_temp.expect_guard($q$UPDATE public.locations SET is_active = false WHERE id = '00000000-0000-0000-0000-000000000105'$q$, 'Alt Antrenor');

    UPDATE public.locations SET name = 'Bazin Club Redenumit', description = 'nou', address = 'Str. A 1', lat = 45.7
    WHERE id = '00000000-0000-0000-0000-000000000101';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'Club could not rename its shared location'; END IF;

    UPDATE public.locations SET is_active = false, address = 'Str. B 20', lat = 45.71
    WHERE id = '00000000-0000-0000-0000-000000000102';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'Club could not change a location only it uses'; END IF;

    UPDATE public.locations SET is_active = true WHERE id = '00000000-0000-0000-0000-000000000102';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'Club could not reactivate its location'; END IF;
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
DO $$
DECLARE
    v_rows integer;
BEGIN
    PERFORM pg_temp.expect_guard($q$UPDATE public.locations SET is_active = false WHERE id = '00000000-0000-0000-0000-000000000103'$q$, 'Club Unu');
    PERFORM pg_temp.expect_guard($q$UPDATE public.locations SET lat = 46.0 WHERE id = '00000000-0000-0000-0000-000000000104'$q$, 'Alt Antrenor');

    UPDATE public.locations SET description = 'doar descriere' WHERE id = '00000000-0000-0000-0000-000000000103';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'Coach could not edit the description of a shared location'; END IF;
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
DO $$
DECLARE
    v_rows integer;
BEGIN
    UPDATE public.locations SET is_active = false, address = 'Str. Admin 1', city = 'Timișoara', county = 'Timiș', lat = 45.75, lng = 21.22
    WHERE id IN ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000104');
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 3 THEN RAISE EXCEPTION 'Admin was blocked on shared locations: % rows', v_rows; END IF;

    DELETE FROM public.locations WHERE id = '00000000-0000-0000-0000-000000000105';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'Admin could not delete a shared location'; END IF;
END;
$$;

RESET ROLE;
RESET request.jwt.claim.sub;
DO $$
DECLARE
    v_rows integer;
BEGIN
    UPDATE public.locations SET is_active = true WHERE id = '00000000-0000-0000-0000-000000000104';
    UPDATE public.locations SET is_active = false WHERE id = '00000000-0000-0000-0000-000000000104';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'Calls without a user were blocked'; END IF;
    IF has_function_privilege('authenticated', 'public.guard_shared_location()', 'EXECUTE') THEN
        RAISE EXCEPTION 'authenticated can execute the guard function directly';
    END IF;
END;
$$;
ROLLBACK;
