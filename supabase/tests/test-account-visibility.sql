\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END;
$$;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE public.profiles (id uuid PRIMARY KEY, name text NOT NULL, role text NOT NULL);
CREATE TABLE public.clubs (id uuid PRIMARY KEY, owner_user_id uuid NOT NULL REFERENCES public.profiles(id), name text NOT NULL);
CREATE TABLE public.coach_profiles (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.profiles(id));
CREATE TABLE public.courses (id uuid PRIMARY KEY, coach_id uuid REFERENCES public.profiles(id), club_id uuid REFERENCES public.clubs(id));
CREATE TABLE public.camps (id uuid PRIMARY KEY, coach_id uuid REFERENCES public.profiles(id), club_id uuid REFERENCES public.clubs(id));
CREATE TABLE public.activities (id uuid PRIMARY KEY, coach_id uuid REFERENCES public.profiles(id), club_id uuid REFERENCES public.clubs(id));
CREATE TABLE public.competitions (id uuid PRIMARY KEY, coach_id uuid REFERENCES public.profiles(id), club_id uuid REFERENCES public.clubs(id));
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO anon, authenticated;

\i /tmp/migrations/00112_test_account_visibility.sql

INSERT INTO public.profiles VALUES
    ('00000000-0000-0000-0000-000000000001', 'Antrenor real', 'COACH'),
    ('00000000-0000-0000-0000-000000000002', 'Antrenor test', 'COACH'),
    ('00000000-0000-0000-0000-000000000003', 'Club real', 'CLUB'),
    ('00000000-0000-0000-0000-000000000004', 'Club test', 'CLUB');
UPDATE public.profiles SET is_test_account = true
WHERE id IN ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004');

INSERT INTO public.clubs VALUES
    ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'Real'),
    ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'Test');
INSERT INTO public.coach_profiles VALUES
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
    ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002');
INSERT INTO public.courses VALUES
    ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NULL),
    ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', NULL),
    ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004'),
    ('30000000-0000-0000-0000-000000000004', NULL, '10000000-0000-0000-0000-000000000003');
INSERT INTO public.camps SELECT * FROM public.courses;
INSERT INTO public.activities SELECT * FROM public.courses;
INSERT INTO public.competitions SELECT * FROM public.courses;

SET LOCAL ROLE anon;
DO $$
DECLARE
    v_hidden text;
BEGIN
    SELECT string_agg(right(c.id::text, 1), ',' ORDER BY c.id) INTO v_hidden
    FROM public.courses c WHERE public.hidden_from_public(c);
    IF v_hidden IS DISTINCT FROM '2,3' THEN RAISE EXCEPTION 'courses hidden: %', v_hidden; END IF;
    SELECT string_agg(right(c.id::text, 1), ',' ORDER BY c.id) INTO v_hidden
    FROM public.camps c WHERE public.hidden_from_public(c);
    IF v_hidden IS DISTINCT FROM '2,3' THEN RAISE EXCEPTION 'camps hidden: %', v_hidden; END IF;
    SELECT string_agg(right(c.id::text, 1), ',' ORDER BY c.id) INTO v_hidden
    FROM public.activities c WHERE public.hidden_from_public(c);
    IF v_hidden IS DISTINCT FROM '2,3' THEN RAISE EXCEPTION 'activities hidden: %', v_hidden; END IF;
    SELECT string_agg(right(c.id::text, 1), ',' ORDER BY c.id) INTO v_hidden
    FROM public.competitions c WHERE public.hidden_from_public(c);
    IF v_hidden IS DISTINCT FROM '2,3' THEN RAISE EXCEPTION 'competitions hidden: %', v_hidden; END IF;
    SELECT string_agg(right(c.id::text, 1), ',' ORDER BY c.id) INTO v_hidden
    FROM public.clubs c WHERE public.hidden_from_public(c);
    IF v_hidden IS DISTINCT FROM '4' THEN RAISE EXCEPTION 'clubs hidden: %', v_hidden; END IF;
    SELECT string_agg(right(c.id::text, 1), ',' ORDER BY c.id) INTO v_hidden
    FROM public.coach_profiles c WHERE public.hidden_from_public(c);
    IF v_hidden IS DISTINCT FROM '2' THEN RAISE EXCEPTION 'coaches hidden: %', v_hidden; END IF;

    BEGIN
        PERFORM private.is_test_owner(NULL, NULL);
        RAISE EXCEPTION 'anon executed private.is_test_owner';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
BEGIN
    BEGIN
        UPDATE public.profiles SET is_test_account = false WHERE id = '00000000-0000-0000-0000-000000000002';
        RAISE EXCEPTION 'authenticated cleared the flag';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        UPDATE public.profiles SET is_test_account = true WHERE id = '00000000-0000-0000-0000-000000000001';
        RAISE EXCEPTION 'authenticated set the flag';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        INSERT INTO public.profiles (id, name, role, is_test_account)
        VALUES ('00000000-0000-0000-0000-000000000009', 'Nou', 'PARENT', true);
        RAISE EXCEPTION 'authenticated inserted a flagged profile';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    UPDATE public.profiles SET name = 'Antrenor test redenumit' WHERE id = '00000000-0000-0000-0000-000000000002';
    INSERT INTO public.profiles (id, name, role) VALUES ('00000000-0000-0000-0000-000000000009', 'Nou', 'PARENT');
END;
$$;
RESET ROLE;

DO $$
BEGIN
    IF NOT (SELECT is_test_account FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002') THEN
        RAISE EXCEPTION 'flag lost after a name update';
    END IF;
    IF (SELECT is_test_account FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000009') THEN
        RAISE EXCEPTION 'new profile is flagged by default';
    END IF;
END;
$$;

ROLLBACK;
\echo 'test-account-visibility: ok'
