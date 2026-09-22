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

CREATE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')
$$;

CREATE FUNCTION public.my_club_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.club_id', true), '')::uuid
$$;

CREATE FUNCTION public.my_club_coach_user_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.roster_coach_id', true), '')::uuid
$$;

CREATE TABLE public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    coach_id UUID NOT NULL,
    club_id UUID,
    sport_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    location_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000002',
    activity_date DATE NOT NULL DEFAULT DATE '2026-10-20',
    start_time TIME NOT NULL DEFAULT TIME '10:00',
    end_time TIME NOT NULL DEFAULT TIME '11:00',
    active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.activities TO authenticated;
CREATE POLICY "activities_select" ON public.activities
    FOR SELECT TO authenticated
    USING (true);

\i /tmp/migrations/00067_club_activity_management.sql

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'CLUB';
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000201';
SET LOCAL request.jwt.claim.club_id = '00000000-0000-0000-0000-000000000301';
SET LOCAL request.jwt.claim.roster_coach_id = '00000000-0000-0000-0000-000000000101';

INSERT INTO public.activities (id, name, coach_id, club_id)
VALUES (
    '00000000-0000-0000-0000-000000000021',
    'Atelier club',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000301'
);

UPDATE public.activities
SET name = 'Atelier club editat'
WHERE id = '00000000-0000-0000-0000-000000000021';

DO $$
BEGIN
    IF (SELECT name FROM public.activities WHERE id = '00000000-0000-0000-0000-000000000021')
        IS DISTINCT FROM 'Atelier club editat' THEN
        RAISE EXCEPTION 'Club must be able to edit its activity';
    END IF;
    BEGIN
        INSERT INTO public.activities (name, coach_id, club_id)
        VALUES (
            'Antrenor din afara',
            '00000000-0000-0000-0000-000000000199',
            '00000000-0000-0000-0000-000000000301'
        );
        RAISE EXCEPTION 'Club must not assign a coach outside the roster';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;

SET LOCAL request.jwt.claim.role = 'COACH';
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000101';
SET LOCAL request.jwt.claim.club_id = '';
SET LOCAL request.jwt.claim.roster_coach_id = '';

INSERT INTO public.activities (id, name, coach_id)
VALUES (
    '00000000-0000-0000-0000-000000000022',
    'Atelier antrenor',
    '00000000-0000-0000-0000-000000000101'
);

UPDATE public.activities
SET name = 'Atelier antrenor editat'
WHERE id = '00000000-0000-0000-0000-000000000022';

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000199';
UPDATE public.activities
SET name = 'Preluat'
WHERE id = '00000000-0000-0000-0000-000000000022';

DO $$
BEGIN
    IF (SELECT name FROM public.activities WHERE id = '00000000-0000-0000-0000-000000000022')
        IS DISTINCT FROM 'Atelier antrenor editat' THEN
        RAISE EXCEPTION 'Another coach must not edit the activity';
    END IF;
END;
$$;

RESET ROLE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'limiteaza_regulament_activitate_club'
    ) THEN
        RAISE EXCEPTION 'The club activity column guard must be gone';
    END IF;
END;
$$;

RESET ROLE;
ROLLBACK;
