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

CREATE TABLE public.profiles (id UUID PRIMARY KEY, role TEXT NOT NULL);
CREATE TABLE public.clubs (
    id UUID PRIMARY KEY,
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

INSERT INTO public.profiles (id, role) VALUES
    ('00000000-0000-0000-0000-0000000000a1', 'ADMIN'),
    ('00000000-0000-0000-0000-0000000000b1', 'PARENT'),
    ('00000000-0000-0000-0000-0000000000c1', 'COACH'),
    ('00000000-0000-0000-0000-0000000000c2', 'COACH'),
    ('00000000-0000-0000-0000-0000000000c3', 'COACH'),
    ('00000000-0000-0000-0000-0000000000d1', 'CLUB'),
    ('00000000-0000-0000-0000-0000000000d2', 'CLUB');
INSERT INTO public.clubs (id, owner_user_id) VALUES
    ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1'),
    ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d2');
INSERT INTO public.coach_profiles (id, user_id) VALUES
    ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1'),
    ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c2'),
    ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000c3');
INSERT INTO public.club_coaches (club_id, coach_profile_id) VALUES
    ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f3');

DO $$
BEGIN
    PERFORM pg_temp.expect(
        (SELECT array_agg(code || ':' || subscriber_type || ':' || price_bani || ':' || COALESCE(coach_limit::text, '-') ORDER BY price_bani)
         FROM public.subscription_plans)
        = ARRAY['COACH:COACH:10000:-', 'CLUB_START:CLUB:19900:3', 'CLUB:CLUB:34900:10', 'CLUB_PRO:CLUB:59900:-'],
        'four plans with the spec prices and limits');
    PERFORM pg_temp.expect(
        (SELECT count(*) = 1 AND bool_and(launch_at IS NULL AND launch_trial_days = 90 AND signup_trial_days = 30)
         FROM public.subscription_settings),
        'one settings row, launch_at NULL, 90/30 days');
    PERFORM pg_temp.expect_error($q$INSERT INTO public.subscription_settings (launch_at) VALUES (now())$q$);
END;
$$;

INSERT INTO public.subscriptions (id, subscriber_type, coach_user_id, club_id, plan_code, status, current_period_end) VALUES
    ('00000000-0000-0000-0000-000000000101', 'COACH', '00000000-0000-0000-0000-0000000000c1', NULL, 'COACH', 'active', now() + interval '20 days'),
    ('00000000-0000-0000-0000-000000000102', 'COACH', '00000000-0000-0000-0000-0000000000c2', NULL, NULL, 'expired', NULL),
    ('00000000-0000-0000-0000-000000000103', 'COACH', '00000000-0000-0000-0000-0000000000c3', NULL, NULL, 'expired', NULL),
    ('00000000-0000-0000-0000-000000000201', 'CLUB', NULL, '00000000-0000-0000-0000-0000000000e1', 'CLUB_START', 'active', now() + interval '20 days'),
    ('00000000-0000-0000-0000-000000000202', 'CLUB', NULL, '00000000-0000-0000-0000-0000000000e2', NULL, 'expired', NULL);
INSERT INTO public.subscription_adjustments (subscription_id, admin_user_id, days, reason) VALUES
    ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-0000000000a1', 14, 'Prelungire de test');
INSERT INTO public.subscription_events (stripe_event_id, type) VALUES ('evt_test1', 'invoice.paid');

DO $$
BEGIN
    PERFORM pg_temp.expect_error($q$INSERT INTO public.subscriptions (subscriber_type, coach_user_id, club_id)
        VALUES ('COACH', NULL, '00000000-0000-0000-0000-0000000000e1')$q$);
    PERFORM pg_temp.expect_error($q$INSERT INTO public.subscriptions (subscriber_type, coach_user_id, club_id)
        VALUES ('CLUB', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1')$q$);
    PERFORM pg_temp.expect_error($q$INSERT INTO public.subscriptions (subscriber_type, coach_user_id)
        VALUES ('COACH', '00000000-0000-0000-0000-0000000000c1')$q$);
    PERFORM pg_temp.expect_error($q$UPDATE public.subscriptions SET plan_code = 'CLUB'
        WHERE id = '00000000-0000-0000-0000-000000000101'$q$);
    PERFORM pg_temp.expect_error($q$UPDATE public.subscriptions SET scheduled_plan_code = 'COACH'
        WHERE id = '00000000-0000-0000-0000-000000000201'$q$);
    PERFORM pg_temp.expect_error($q$UPDATE public.subscriptions SET plan_code = 'NOPE'
        WHERE id = '00000000-0000-0000-0000-000000000201'$q$);
    PERFORM pg_temp.expect_error($q$UPDATE public.subscriptions SET status = 'paused'
        WHERE id = '00000000-0000-0000-0000-000000000201'$q$);
    PERFORM pg_temp.expect_error($q$UPDATE public.subscriptions SET terms_version = '2.0'
        WHERE id = '00000000-0000-0000-0000-000000000201'$q$);
    PERFORM pg_temp.expect_error($q$DELETE FROM public.subscription_plans WHERE code = 'CLUB_START'$q$);
    PERFORM pg_temp.expect_error($q$INSERT INTO public.subscription_events (stripe_event_id, type) VALUES ('evt_test1', 'invoice.paid')$q$);
    PERFORM pg_temp.expect_error($q$INSERT INTO public.subscription_adjustments (subscription_id, days, reason)
        VALUES ('00000000-0000-0000-0000-000000000201', 0, 'zero zile')$q$);
END;
$$;

CREATE FUNCTION pg_temp.client_write_attempts()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM pg_temp.expect_denied($q$INSERT INTO public.subscriptions (subscriber_type, coach_user_id) VALUES ('COACH', '00000000-0000-0000-0000-0000000000b1')$q$);
    PERFORM pg_temp.expect_denied($q$UPDATE public.subscriptions SET status = 'active'$q$);
    PERFORM pg_temp.expect_denied($q$DELETE FROM public.subscriptions$q$);
    PERFORM pg_temp.expect_denied($q$INSERT INTO public.subscription_plans (code, subscriber_type, name, price_bani) VALUES ('FREE', 'COACH', 'Gratis', 1)$q$);
    PERFORM pg_temp.expect_denied($q$UPDATE public.subscription_plans SET price_bani = 1$q$);
    PERFORM pg_temp.expect_denied($q$DELETE FROM public.subscription_plans$q$);
    PERFORM pg_temp.expect_denied($q$UPDATE public.subscription_settings SET launch_at = now()$q$);
    PERFORM pg_temp.expect_denied($q$DELETE FROM public.subscription_settings$q$);
    PERFORM pg_temp.expect_denied($q$INSERT INTO public.subscription_settings (launch_at) VALUES (NULL)$q$);
    PERFORM pg_temp.expect_denied($q$SELECT count(*) FROM public.subscription_events$q$);
    PERFORM pg_temp.expect_denied($q$INSERT INTO public.subscription_events (stripe_event_id, type) VALUES ('evt_x', 'x')$q$);
    PERFORM pg_temp.expect_denied($q$INSERT INTO public.subscription_adjustments (subscription_id, days, reason) VALUES ('00000000-0000-0000-0000-000000000201', 30, 'cadou')$q$);
    PERFORM pg_temp.expect_denied($q$UPDATE public.subscription_adjustments SET days = 366$q$);
    PERFORM pg_temp.expect_denied($q$DELETE FROM public.subscription_adjustments$q$);
    PERFORM pg_temp.expect_denied($q$SELECT private.subscriber_has_access_at(NULL, '00000000-0000-0000-0000-0000000000c1', now())$q$);
    PERFORM pg_temp.expect_denied($q$SELECT private.coach_has_access_at('00000000-0000-0000-0000-0000000000c1', now())$q$);
    PERFORM pg_temp.expect((SELECT count(*) FROM public.subscription_plans) = 4, 'plans are readable');
    PERFORM pg_temp.expect((SELECT count(*) FROM public.subscription_settings) = 1, 'settings are readable');
    PERFORM pg_temp.expect(public.offer_has_access(NULL, '00000000-0000-0000-0000-0000000000c2'), 'public access functions are executable');
END;
$$;
GRANT EXECUTE ON FUNCTION pg_temp.client_write_attempts() TO anon, authenticated;

SET LOCAL ROLE anon;
DO $$
BEGIN
    PERFORM pg_temp.expect_denied($q$SELECT count(*) FROM public.subscriptions$q$);
    PERFORM pg_temp.expect_denied($q$SELECT count(*) FROM public.subscription_adjustments$q$);
    PERFORM pg_temp.client_write_attempts();
END;
$$;
RESET ROLE;

CREATE FUNCTION pg_temp.visible_subscriptions()
RETURNS text[]
LANGUAGE sql
AS $$
    SELECT COALESCE(array_agg(right(id::text, 3) ORDER BY id), ARRAY[]::text[]) FROM public.subscriptions
$$;
GRANT EXECUTE ON FUNCTION pg_temp.visible_subscriptions() TO authenticated;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
DO $$
BEGIN
    PERFORM pg_temp.expect(pg_temp.visible_subscriptions() = ARRAY[]::text[], 'parent sees no subscription');
    PERFORM pg_temp.expect((SELECT count(*) FROM public.subscription_adjustments) = 0, 'parent sees no adjustment');
    PERFORM pg_temp.client_write_attempts();
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
DO $$
BEGIN
    PERFORM pg_temp.expect(pg_temp.visible_subscriptions() = ARRAY['101'], 'coach sees only their own row');
    PERFORM pg_temp.expect((SELECT count(*) FROM public.subscription_adjustments) = 0, 'coach sees no adjustment');
    PERFORM pg_temp.client_write_attempts();
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
DO $$
BEGIN
    PERFORM pg_temp.expect(pg_temp.visible_subscriptions() = ARRAY['102'], 'other coach sees only their own row');
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
DO $$
BEGIN
    PERFORM pg_temp.expect(pg_temp.visible_subscriptions() = ARRAY['103'], 'club coach does not see the club row');
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
DO $$
BEGIN
    PERFORM pg_temp.expect(pg_temp.visible_subscriptions() = ARRAY['201'], 'club owner sees only their club row');
    PERFORM pg_temp.expect((SELECT count(*) FROM public.subscription_adjustments) = 0, 'club owner sees no adjustment');
    PERFORM pg_temp.client_write_attempts();
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
DO $$
BEGIN
    PERFORM pg_temp.expect(pg_temp.visible_subscriptions() = ARRAY['202'], 'other club sees only their club row');
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
DO $$
BEGIN
    PERFORM pg_temp.expect(pg_temp.visible_subscriptions() = ARRAY['101', '102', '103', '201', '202'], 'ADMIN sees every row');
    PERFORM pg_temp.expect((SELECT count(*) FROM public.subscription_adjustments) = 1, 'ADMIN sees adjustments');
    PERFORM pg_temp.client_write_attempts();
END;
$$;
RESET ROLE;

DO $$
DECLARE
    c1 CONSTANT UUID := '00000000-0000-0000-0000-0000000000c1';
    c2 CONSTANT UUID := '00000000-0000-0000-0000-0000000000c2';
    c3 CONSTANT UUID := '00000000-0000-0000-0000-0000000000c3';
    k1 CONSTANT UUID := '00000000-0000-0000-0000-0000000000e1';
    k2 CONSTANT UUID := '00000000-0000-0000-0000-0000000000e2';
    nobody CONSTANT UUID := '00000000-0000-0000-0000-0000000000b1';
    launch CONSTANT TIMESTAMPTZ := '2026-11-06 00:00:00+02';
    t CONSTANT TIMESTAMPTZ := '2027-03-01 12:00:00+00';
    s CONSTANT INTERVAL := interval '1 second';
BEGIN
    PERFORM pg_temp.expect(public.subscriber_has_access(NULL, c2), 'launch_at NULL: expired coach keeps access');
    PERFORM pg_temp.expect(public.subscriber_has_access(k2, NULL), 'launch_at NULL: expired club keeps access');
    PERFORM pg_temp.expect(public.subscriber_has_access(NULL, nobody), 'launch_at NULL: account without a row keeps access');
    PERFORM pg_temp.expect(public.coach_has_access(c3), 'launch_at NULL: coach keeps access');
    PERFORM pg_temp.expect(public.offer_has_access(NULL, c2), 'launch_at NULL: coach offer keeps access');
    PERFORM pg_temp.expect(NOT public.subscriber_has_access(NULL, NULL), 'no subscriber is never a valid subscriber');
    PERFORM pg_temp.expect(NOT public.subscriber_has_access(k1, c1), 'two subscribers at once are refused');

    UPDATE public.subscription_settings SET launch_at = launch;

    PERFORM pg_temp.expect(NOT private.subscriber_has_access_at(NULL, nobody, t), 'after launch an account without a row has no access');

    UPDATE public.subscriptions SET status = 'trialing', trial_end = NULL, current_period_end = NULL, plan_code = NULL
        WHERE coach_user_id = c2;
    PERFORM pg_temp.expect(private.subscriber_has_access_at(NULL, c2, launch + interval '90 days' - s), 'launch promotion: last second of the 3 months');
    PERFORM pg_temp.expect(NOT private.subscriber_has_access_at(NULL, c2, launch + interval '90 days'), 'launch promotion ends at launch + 90 days');
    UPDATE public.subscription_settings SET launch_trial_days = 30;
    PERFORM pg_temp.expect(NOT private.subscriber_has_access_at(NULL, c2, launch + interval '30 days'), 'launch promotion follows launch_trial_days');
    UPDATE public.subscription_settings SET launch_trial_days = 90;

    UPDATE public.subscriptions SET trial_end = t WHERE coach_user_id = c2;
    PERFORM pg_temp.expect(private.subscriber_has_access_at(NULL, c2, t - s), 'trialing: access before trial_end');
    PERFORM pg_temp.expect(NOT private.subscriber_has_access_at(NULL, c2, t), 'trialing: no access at trial_end');

    UPDATE public.subscriptions SET status = 'active', plan_code = 'COACH', trial_end = NULL, current_period_end = t
        WHERE coach_user_id = c2;
    PERFORM pg_temp.expect(private.subscriber_has_access_at(NULL, c2, t + interval '1 day' - s), 'active: one day of tolerance');
    PERFORM pg_temp.expect(NOT private.subscriber_has_access_at(NULL, c2, t + interval '1 day'), 'active: no access one day after the period');

    UPDATE public.subscriptions SET current_period_end = NULL WHERE coach_user_id = c2;
    PERFORM pg_temp.expect(NOT private.subscriber_has_access_at(NULL, c2, t), 'active without a period end has no access');

    UPDATE public.subscriptions SET status = 'past_due', current_period_end = t, past_due_since = t WHERE coach_user_id = c2;
    PERFORM pg_temp.expect(private.subscriber_has_access_at(NULL, c2, t + interval '7 days' - s), 'past_due: 7 days of grace');
    PERFORM pg_temp.expect(NOT private.subscriber_has_access_at(NULL, c2, t + interval '7 days'), 'past_due: no access after the grace');

    UPDATE public.subscriptions SET status = 'canceled', past_due_since = NULL, cancel_at_period_end = true, current_period_end = t
        WHERE coach_user_id = c2;
    PERFORM pg_temp.expect(private.subscriber_has_access_at(NULL, c2, t - s), 'canceled: access until the period end');
    PERFORM pg_temp.expect(NOT private.subscriber_has_access_at(NULL, c2, t), 'canceled: no access at the period end');

    UPDATE public.subscriptions SET status = 'expired', cancel_at_period_end = false WHERE coach_user_id = c2;
    PERFORM pg_temp.expect(NOT private.subscriber_has_access_at(NULL, c2, launch - s), 'expired: never access');

    UPDATE public.subscriptions SET status = 'trialing', trial_end = t WHERE club_id = k2;
    PERFORM pg_temp.expect(private.subscriber_has_access_at(k2, NULL, t - s), 'club trialing: access before trial_end');
    PERFORM pg_temp.expect(NOT private.subscriber_has_access_at(k2, NULL, t), 'club trialing: no access at trial_end');
    UPDATE public.subscriptions SET status = 'expired', trial_end = NULL WHERE club_id = k2;

    PERFORM pg_temp.expect(public.subscriber_has_access(k1, NULL), 'club with an active plan has access now');
    PERFORM pg_temp.expect(NOT public.subscriber_has_access(NULL, c3), 'expired club coach has no own access');
    PERFORM pg_temp.expect(public.coach_has_access(c3), 'club with access covers its coach');
    PERFORM pg_temp.expect(public.coach_has_access(c1), 'coach with own access is listed');
    PERFORM pg_temp.expect(NOT public.coach_has_access(c2), 'coach without access and without a club is not listed');
    PERFORM pg_temp.expect(NOT public.coach_has_access(NULL), 'no coach has no access');

    PERFORM pg_temp.expect(public.offer_has_access(k1, c3), 'club offer is covered by the club, not by the coach');
    PERFORM pg_temp.expect(NOT public.offer_has_access(NULL, c3), 'own offer of a club coach needs the coach subscription');
    PERFORM pg_temp.expect(NOT public.offer_has_access(k2, c1), 'club offer without club access is hidden even if the coach pays');
    PERFORM pg_temp.expect(public.offer_has_access(NULL, c1), 'own offer of a paying coach has access');
    PERFORM pg_temp.expect(public.offer_has_access(NULL, NULL), 'offer without an owner is exempt');

    UPDATE public.subscriptions SET status = 'expired', current_period_end = NULL WHERE club_id = k1;
    PERFORM pg_temp.expect(NOT public.coach_has_access(c3), 'expired club no longer covers its coach');

    UPDATE public.subscription_settings SET launch_at = NULL;
    PERFORM pg_temp.expect(public.coach_has_access(c3) AND public.offer_has_access(k1, c3), 'clearing launch_at restores access');
END;
$$;

DO $$
DECLARE
    v_before TIMESTAMPTZ;
BEGIN
    SELECT updated_at INTO v_before FROM public.subscriptions WHERE id = '00000000-0000-0000-0000-000000000101';
    UPDATE public.subscriptions SET updated_at = '2000-01-01', cancel_at_period_end = true WHERE id = '00000000-0000-0000-0000-000000000101';
    PERFORM pg_temp.expect(
        (SELECT updated_at <> '2000-01-01' FROM public.subscriptions WHERE id = '00000000-0000-0000-0000-000000000101'),
        'updated_at is set by the trigger');

    DELETE FROM public.clubs WHERE id = '00000000-0000-0000-0000-0000000000e1';
    PERFORM pg_temp.expect(NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE id = '00000000-0000-0000-0000-000000000201'), 'club deletion cascades');
    PERFORM pg_temp.expect(NOT EXISTS (SELECT 1 FROM public.subscription_adjustments), 'adjustments cascade with the subscription');
    DELETE FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000c1';
    PERFORM pg_temp.expect(NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE id = '00000000-0000-0000-0000-000000000101'), 'coach deletion cascades');
END;
$$;

SET LOCAL ROLE service_role;
DO $$
BEGIN
    INSERT INTO public.subscription_events (stripe_event_id, type) VALUES ('evt_test2', 'customer.subscription.updated');
    UPDATE public.subscription_events SET processed_at = now() WHERE stripe_event_id = 'evt_test2';
    UPDATE public.subscription_plans SET stripe_price_id = 'price_test123' WHERE code = 'COACH';
    UPDATE public.subscriptions SET status = 'active', current_period_end = now() + interval '30 days', plan_code = 'COACH'
        WHERE id = '00000000-0000-0000-0000-000000000102';
    INSERT INTO public.subscription_adjustments (subscription_id, days, reason)
        VALUES ('00000000-0000-0000-0000-000000000102', 7, 'Test service role');
    PERFORM pg_temp.expect(private.subscriber_has_access_at(NULL, '00000000-0000-0000-0000-0000000000c2', now()), 'service role can call the private helper');
END;
$$;
RESET ROLE;

ROLLBACK;
\echo 'subscriptions: OK'
