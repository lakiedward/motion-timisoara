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
    owner_user_id UUID NOT NULL REFERENCES public.profiles(id),
    name TEXT NOT NULL,
    city TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

CREATE POLICY "clubs_select" ON public.clubs
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "clubs_insert" ON public.clubs
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "clubs_update" ON public.clubs
  FOR UPDATE TO authenticated
  USING (owner_user_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN')
  WITH CHECK (owner_user_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');
GRANT SELECT (id, owner_user_id, name, city, created_at) ON public.clubs TO anon, authenticated;
GRANT INSERT, UPDATE ON public.clubs TO authenticated;

CREATE TABLE public.courses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), club_id UUID REFERENCES public.clubs(id));
CREATE TABLE public.camps (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), club_id UUID REFERENCES public.clubs(id));
CREATE TABLE public.activities (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), club_id UUID REFERENCES public.clubs(id));
CREATE TABLE public.competitions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), club_id UUID REFERENCES public.clubs(id));
GRANT INSERT, UPDATE ON public.courses, public.camps, public.activities, public.competitions TO authenticated;

INSERT INTO public.profiles (id, name, role) VALUES
    ('00000000-0000-0000-0000-0000000000a1', 'Admin', 'ADMIN'),
    ('00000000-0000-0000-0000-0000000000c1', 'Club Vechi', 'CLUB'),
    ('00000000-0000-0000-0000-0000000000c2', 'Club Nou', 'CLUB'),
    ('00000000-0000-0000-0000-0000000000f1', 'Părinte', 'PARENT');
INSERT INTO public.clubs (id, owner_user_id, name, created_at) VALUES
    ('00000000-0000-0000-0000-00000000c100', '00000000-0000-0000-0000-0000000000c1', 'Club Vechi', '2026-09-01T10:00:00Z');

\i /tmp/migrations/00101_club_approval.sql

DO $$
BEGIN
    IF (SELECT approved_at FROM public.clubs WHERE id = '00000000-0000-0000-0000-00000000c100')
       IS DISTINCT FROM '2026-09-01T10:00:00Z'::timestamptz THEN
        RAISE EXCEPTION 'Existing club was not backfilled from created_at';
    END IF;
END;
$$;

INSERT INTO public.clubs (id, owner_user_id, name, approved_at) VALUES
    ('00000000-0000-0000-0000-00000000c200', '00000000-0000-0000-0000-0000000000c2', 'Club Nou', NULL);

CREATE FUNCTION pg_temp.expect_denied(p_sql text, p_hint text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_hint text;
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN insufficient_privilege THEN
        GET STACKED DIAGNOSTICS v_hint = PG_EXCEPTION_HINT;
        IF p_hint IS NOT NULL AND v_hint IS DISTINCT FROM p_hint THEN
            RAISE EXCEPTION 'Wrong hint % for: %', v_hint, p_sql;
        END IF;
        RETURN;
    END;
    RAISE EXCEPTION 'Not denied: %', p_sql;
END;
$$;
GRANT EXECUTE ON FUNCTION pg_temp.expect_denied(text, text) TO anon, authenticated;

SET LOCAL ROLE anon;
DO $$
BEGIN
    IF (SELECT count(*) FROM public.clubs) <> 1 THEN
        RAISE EXCEPTION 'Anon sees a pending club';
    END IF;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
DO $$
BEGIN
    IF (SELECT count(*) FROM public.clubs) <> 1 THEN
        RAISE EXCEPTION 'A parent sees a pending club';
    END IF;
    PERFORM pg_temp.expect_denied($q$SELECT public.approve_club('00000000-0000-0000-0000-00000000c200')$q$);
    PERFORM pg_temp.expect_denied($q$SELECT * FROM public.admin_clubs()$q$);
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
DO $$
DECLARE
    v_rows integer;
BEGIN
    IF (SELECT count(*) FROM public.clubs WHERE id = '00000000-0000-0000-0000-00000000c200') <> 1 THEN
        RAISE EXCEPTION 'Owner cannot see its pending club';
    END IF;
    PERFORM pg_temp.expect_denied($q$UPDATE public.clubs SET approved_at = now() WHERE id = '00000000-0000-0000-0000-00000000c200'$q$);
    PERFORM pg_temp.expect_denied($q$INSERT INTO public.courses (club_id) VALUES ('00000000-0000-0000-0000-00000000c200')$q$, 'club_pending_approval');
    PERFORM pg_temp.expect_denied($q$INSERT INTO public.camps (club_id) VALUES ('00000000-0000-0000-0000-00000000c200')$q$, 'club_pending_approval');
    PERFORM pg_temp.expect_denied($q$INSERT INTO public.activities (club_id) VALUES ('00000000-0000-0000-0000-00000000c200')$q$, 'club_pending_approval');
    PERFORM pg_temp.expect_denied($q$INSERT INTO public.competitions (club_id) VALUES ('00000000-0000-0000-0000-00000000c200')$q$, 'club_pending_approval');

    UPDATE public.clubs SET name = 'Club Nou Redenumit' WHERE id = '00000000-0000-0000-0000-00000000c200';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'Pending owner cannot edit its profile'; END IF;
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
DO $$
BEGIN
    IF (SELECT count(*) FROM public.admin_clubs() WHERE approved_at IS NULL) <> 1 THEN
        RAISE EXCEPTION 'Admin list does not show the pending club';
    END IF;
    PERFORM public.approve_club('00000000-0000-0000-0000-00000000c200');
    PERFORM public.approve_club('00000000-0000-0000-0000-00000000c200');
    BEGIN
        PERFORM public.approve_club('00000000-0000-0000-0000-00000000ffff');
        RAISE EXCEPTION 'Unknown club was accepted';
    EXCEPTION WHEN no_data_found THEN
        NULL;
    END;
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
INSERT INTO public.courses (club_id) VALUES ('00000000-0000-0000-0000-00000000c200');
DO $$
BEGIN
    PERFORM pg_temp.expect_denied($q$UPDATE public.clubs SET approved_at = NULL WHERE id = '00000000-0000-0000-0000-00000000c200'$q$);
END;
$$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $$
BEGIN
    IF (SELECT count(*) FROM public.clubs) <> 2 THEN
        RAISE EXCEPTION 'Approved club is still hidden from anon';
    END IF;
END;
$$;
RESET ROLE;

DO $$
BEGIN
    IF (SELECT approved_by FROM public.clubs WHERE id = '00000000-0000-0000-0000-00000000c200')
       IS DISTINCT FROM '00000000-0000-0000-0000-0000000000a1'::uuid THEN
        RAISE EXCEPTION 'approved_by was not recorded';
    END IF;
END;
$$;

ROLLBACK;
\echo 'club-approval: OK'
