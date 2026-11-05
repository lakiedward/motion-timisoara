\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END;
$$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE TABLE public.profiles (id UUID PRIMARY KEY, role TEXT NOT NULL, name TEXT, email TEXT);
CREATE TABLE public.clubs (
    id UUID PRIMARY KEY,
    name TEXT,
    email TEXT,
    owner_user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE
);
CREATE TABLE public.coach_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE
);
CREATE TABLE public.club_coaches (
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    coach_profile_id UUID NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
    PRIMARY KEY (club_id, coach_profile_id)
);

CREATE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid()
$$;
CREATE FUNCTION public.my_club_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT id FROM public.clubs WHERE owner_user_id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.get_my_role(), public.my_club_ids() TO authenticated;

\i /tmp/migrations/00107_subscriptions.sql
\i /tmp/migrations/00122_admin_subscriptions.sql

CREATE FUNCTION pg_temp.expect_denied(p_sql text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN insufficient_privilege THEN
        RETURN;
    END;
    RAISE EXCEPTION 'Not refused with 42501: %', p_sql;
END;
$$;
CREATE FUNCTION pg_temp.expect_error(p_sql text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN OTHERS THEN
        RETURN;
    END;
    RAISE EXCEPTION 'Not refused: %', p_sql;
END;
$$;
CREATE FUNCTION pg_temp.expect(p_ok boolean, p_message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_ok IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Assertion failed: %', p_message;
    END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION pg_temp.expect_denied(text), pg_temp.expect_error(text), pg_temp.expect(boolean, text)
    TO anon, authenticated, service_role;


INSERT INTO public.profiles (id, role, name, email) VALUES
    ('00000000-0000-0000-0000-0000000000a1', 'ADMIN', 'Admin Test', 'admin@test.ro'),
    ('00000000-0000-0000-0000-0000000000b1', 'PARENT', 'Părinte', 'parent@test.ro'),
    ('00000000-0000-0000-0000-0000000000c1', 'COACH', 'Antrenor Unu', 'c1@test.ro'),
    ('00000000-0000-0000-0000-0000000000c2', 'COACH', 'Antrenor Doi', 'c2@test.ro'),
    ('00000000-0000-0000-0000-0000000000d1', 'CLUB', 'Proprietar Club', 'owner@test.ro');
INSERT INTO public.clubs (id, owner_user_id, name, email) VALUES
    ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'Club Test', 'club@test.ro');
INSERT INTO public.coach_profiles (id, user_id) VALUES
    ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1');
INSERT INTO public.club_coaches (club_id, coach_profile_id) VALUES
    ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1');

UPDATE public.subscription_settings SET launch_at = now() - interval '10 days';
INSERT INTO public.subscriptions (id, subscriber_type, coach_user_id, club_id, plan_code, status, trial_end, current_period_end, past_due_since, stripe_subscription_id) VALUES
    ('00000000-0000-0000-0000-000000000101', 'COACH', '00000000-0000-0000-0000-0000000000c1', NULL, NULL, 'trialing', now() + interval '5 days', NULL, NULL, NULL),
    ('00000000-0000-0000-0000-000000000102', 'COACH', '00000000-0000-0000-0000-0000000000c2', NULL, 'COACH', 'active', NULL, now() + interval '20 days', NULL, 'sub_test102'),
    ('00000000-0000-0000-0000-000000000103', 'CLUB', NULL, '00000000-0000-0000-0000-0000000000e1', 'CLUB_START', 'expired', NULL, NULL, NULL, NULL);

DO $$
DECLARE
    v_row RECORD;
BEGIN
    PERFORM pg_temp.expect(
        abs(extract(epoch FROM private.subscription_access_end('00000000-0000-0000-0000-000000000101') - (now() + interval '5 days'))) < 1,
        'trialing access ends at trial_end');
    PERFORM pg_temp.expect(
        abs(extract(epoch FROM private.subscription_access_end('00000000-0000-0000-0000-000000000102') - (now() + interval '21 days'))) < 1,
        'active access ends one day after the period end');
    PERFORM pg_temp.expect(
        private.subscription_access_end('00000000-0000-0000-0000-000000000103') IS NULL,
        'expired has no access end');

    SELECT * INTO v_row FROM public.begin_subscription_extension('00000000-0000-0000-0000-000000000101', 30);
    PERFORM pg_temp.expect(
        abs(extract(epoch FROM v_row.new_end - (now() + interval '35 days'))) < 1 AND v_row.stripe_subscription_id IS NULL,
        'a trial is extended from its current end');
    SELECT * INTO v_row FROM public.begin_subscription_extension('00000000-0000-0000-0000-000000000103', 7);
    PERFORM pg_temp.expect(
        abs(extract(epoch FROM v_row.new_end - (now() + interval '7 days'))) < 1 AND v_row.previous_end IS NULL,
        'an expired subscription is extended from now');
    PERFORM pg_temp.expect(
        (SELECT stripe_subscription_id FROM public.begin_subscription_extension('00000000-0000-0000-0000-000000000102', 7)) = 'sub_test102',
        'the Stripe subscription id is returned');
    PERFORM pg_temp.expect_error($q$SELECT * FROM public.begin_subscription_extension('00000000-0000-0000-0000-000000000101', 0)$q$);
    PERFORM pg_temp.expect_error($q$SELECT * FROM public.begin_subscription_extension('00000000-0000-0000-0000-000000000101', 367)$q$);
    PERFORM pg_temp.expect_error($q$SELECT * FROM public.begin_subscription_extension('00000000-0000-0000-0000-0000000000ff', 7)$q$);

    UPDATE public.subscription_settings SET launch_at = NULL;
    UPDATE public.subscriptions SET trial_end = NULL WHERE id = '00000000-0000-0000-0000-000000000101';
    PERFORM pg_temp.expect_error($q$SELECT * FROM public.begin_subscription_extension('00000000-0000-0000-0000-000000000101', 7)$q$);
    UPDATE public.subscription_settings SET launch_at = now() - interval '10 days';
    UPDATE public.subscriptions SET trial_end = now() + interval '5 days' WHERE id = '00000000-0000-0000-0000-000000000101';
END;
$$;

DO $$
DECLARE
    v_id UUID;
BEGIN
    v_id := public.apply_subscription_extension(
        '00000000-0000-0000-0000-000000000103',
        '00000000-0000-0000-0000-0000000000a1',
        7, 'Test prelungire', now() + interval '7 days');
    PERFORM pg_temp.expect(
        (SELECT status = 'trialing' AND abs(extract(epoch FROM trial_end - (now() + interval '7 days'))) < 1
         FROM public.subscriptions WHERE id = '00000000-0000-0000-0000-000000000103'),
        'apply moves the subscription to a trial ending at the new date');
    PERFORM pg_temp.expect(
        (SELECT count(*) = 1 AND bool_and(days = 7 AND reason = 'Test prelungire' AND admin_user_id = '00000000-0000-0000-0000-0000000000a1')
         FROM public.subscription_adjustments WHERE id = v_id),
        'apply logs the days, reason and admin');
    PERFORM pg_temp.expect(
        private.subscriber_has_access_at('00000000-0000-0000-0000-0000000000e1', NULL, now() + interval '6 days')
        AND NOT private.subscriber_has_access_at('00000000-0000-0000-0000-0000000000e1', NULL, now() + interval '8 days'),
        'access follows the extended trial');
    PERFORM pg_temp.expect_error($q$SELECT public.apply_subscription_extension('00000000-0000-0000-0000-000000000103', NULL, 7, 'x', now() - interval '1 day')$q$);
    PERFORM pg_temp.expect_error($q$SELECT public.apply_subscription_extension('00000000-0000-0000-0000-000000000103', NULL, 7, 'x', now() + interval '900 days')$q$);
    PERFORM pg_temp.expect_error($q$SELECT public.apply_subscription_extension('00000000-0000-0000-0000-000000000103', NULL, 7, 'ab', now() + interval '7 days')$q$);
END;
$$;

SET LOCAL ROLE service_role;
DO $$
BEGIN
    PERFORM pg_temp.expect((SELECT count(*) FROM public.begin_subscription_extension('00000000-0000-0000-0000-000000000101', 5)) = 1,
        'service role can call begin');
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
DO $$
DECLARE
    v_rows INTEGER;
BEGIN
    SELECT count(*) INTO v_rows FROM public.get_admin_subscriptions();
    PERFORM pg_temp.expect(v_rows = 3, 'admin lists all subscriptions');
    PERFORM pg_temp.expect(
        (SELECT subscriber_name = 'Club Test' AND subscriber_email = 'club@test.ro' AND plan_name = 'Club Start'
                AND price_bani = 19900 AND coach_count = 1 AND jsonb_array_length(adjustments) = 1
                AND adjustments -> 0 ->> 'admin_name' = 'Admin Test'
         FROM public.get_admin_subscriptions() WHERE id = '00000000-0000-0000-0000-000000000103'),
        'club row has name, plan, price, coach count and the logged extension');
    PERFORM pg_temp.expect(
        (SELECT subscriber_name = 'Antrenor Doi' AND has_stripe_subscription AND coach_count IS NULL
         FROM public.get_admin_subscriptions() WHERE id = '00000000-0000-0000-0000-000000000102'),
        'coach row has name and Stripe flag');
    PERFORM pg_temp.expect_denied($q$SELECT * FROM public.begin_subscription_extension('00000000-0000-0000-0000-000000000101', 5)$q$);
    PERFORM pg_temp.expect_denied($q$SELECT public.apply_subscription_extension('00000000-0000-0000-0000-000000000101', NULL, 5, 'abc', now() + interval '5 days')$q$);
    PERFORM pg_temp.expect_denied($q$SELECT private.subscription_access_end('00000000-0000-0000-0000-000000000101')$q$);
END;
$$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
DO $$
BEGIN
    PERFORM pg_temp.expect_denied($q$SELECT * FROM public.get_admin_subscriptions()$q$);
END;
$$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
DO $$
BEGIN
    PERFORM pg_temp.expect_denied($q$SELECT * FROM public.get_admin_subscriptions()$q$);
END;
$$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $$
BEGIN
    PERFORM pg_temp.expect_denied($q$SELECT * FROM public.get_admin_subscriptions()$q$);
    PERFORM pg_temp.expect_denied($q$SELECT * FROM public.begin_subscription_extension('00000000-0000-0000-0000-000000000101', 5)$q$);
END;
$$;
RESET ROLE;

ROLLBACK;
\echo 'admin-subscriptions: OK'
