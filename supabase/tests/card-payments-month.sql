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

CREATE TABLE public.profiles (id UUID PRIMARY KEY, role TEXT NOT NULL);
CREATE TABLE public.coach_profiles (user_id UUID PRIMARY KEY, stripe_account_id TEXT);
CREATE TABLE public.clubs (id UUID PRIMARY KEY, owner_user_id UUID UNIQUE, stripe_account_id TEXT);
CREATE TABLE public.payments (
    id UUID PRIMARY KEY, method TEXT, amount BIGINT, currency TEXT, status TEXT,
    paid_at TIMESTAMPTZ, platform_fee_amount BIGINT, coach_payout_amount BIGINT
);

\i /tmp/migrations/00115_stripe_fee_settlement.sql

INSERT INTO public.profiles VALUES
    ('00000000-0000-0000-0000-0000000000c1', 'COACH'),
    ('00000000-0000-0000-0000-0000000000c2', 'COACH'),
    ('00000000-0000-0000-0000-0000000000b1', 'CLUB'),
    ('00000000-0000-0000-0000-0000000000a1', 'ADMIN'),
    ('00000000-0000-0000-0000-0000000000dd', 'PARENT');
INSERT INTO public.coach_profiles VALUES
    ('00000000-0000-0000-0000-0000000000c1', 'acct_coach'),
    ('00000000-0000-0000-0000-0000000000c2', NULL);
INSERT INTO public.clubs VALUES
    ('00000000-0000-0000-0000-00000000cb01', '00000000-0000-0000-0000-0000000000b1', 'acct_club');

INSERT INTO public.payments (id, method, amount, currency, status, paid_at, platform_fee_amount,
    coach_payout_amount, stripe_fee_amount, stripe_destination_account) VALUES
    ('00000000-0000-0000-0000-0000000000f1', 'CARD', 50000, 'RON', 'SUCCEEDED', now(), 850, 49150, 850, 'acct_coach'),
    ('00000000-0000-0000-0000-0000000000f2', 'CARD', 30000, 'RON', 'SUCCEEDED', now(), 1645, 28355, NULL, 'acct_coach'),
    ('00000000-0000-0000-0000-0000000000f3', 'CARD', 20000, 'RON', 'SUCCEEDED',
        date_trunc('month', now() AT TIME ZONE 'Europe/Bucharest') AT TIME ZONE 'Europe/Bucharest' - INTERVAL '1 second',
        400, 19600, 400, 'acct_coach'),
    ('00000000-0000-0000-0000-0000000000f4', 'CARD', 40000, 'RON', 'PENDING', NULL, 2160, 37840, NULL, 'acct_coach'),
    ('00000000-0000-0000-0000-0000000000f5', 'CARD', 40000, 'RON', 'REFUNDED', now(), 700, 39300, 700, 'acct_coach'),
    ('00000000-0000-0000-0000-0000000000f6', 'CASH', 40000, 'RON', 'SUCCEEDED', now(), NULL, NULL, NULL, NULL),
    ('00000000-0000-0000-0000-0000000000f7', 'CARD', 70000, 'RON', 'SUCCEEDED', now(), 1205, 68795, 1205, 'acct_club');

INSERT INTO public.payments (id, method, amount, currency, status, paid_at, platform_fee_amount,
    coach_payout_amount, stripe_fee_amount) VALUES
    ('00000000-0000-0000-0000-0000000000f8', 'CARD', 10000, 'RON', 'SUCCEEDED', now(), 0, 10000, NULL);

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
GRANT EXECUTE ON FUNCTION pg_temp.expect_error(text) TO anon, authenticated;

DO $$
BEGIN
    BEGIN
        INSERT INTO public.payments (id, method, amount, currency, status, stripe_fee_amount)
        VALUES ('00000000-0000-0000-0000-0000000000f9', 'CARD', 100, 'RON', 'SUCCEEDED', -1);
    EXCEPTION WHEN check_violation THEN
        RETURN;
    END;
    RAISE EXCEPTION 'A negative Stripe fee was accepted';
END;
$$;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
    v_row RECORD;
BEGIN
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
    SELECT * INTO v_row FROM public.get_card_payments_month();
    IF v_row.collected <> 80000 OR v_row.stripe_fee <> 2495 OR v_row.net <> 77505
       OR v_row.payment_count <> 2 OR v_row.unsettled_count <> 1 THEN
        RAISE EXCEPTION 'Coach month must count only this month''s successful card payments to their account: %', row_to_json(v_row);
    END IF;
    IF v_row.month_start <> date_trunc('month', now() AT TIME ZONE 'Europe/Bucharest')::DATE THEN
        RAISE EXCEPTION 'Month must start on the first day in Romania: %', v_row.month_start;
    END IF;

    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
    SELECT * INTO v_row FROM public.get_card_payments_month();
    IF v_row.collected <> 70000 OR v_row.stripe_fee <> 1205 OR v_row.net <> 68795 OR v_row.payment_count <> 1 THEN
        RAISE EXCEPTION 'Club month must count the payments to the club account: %', row_to_json(v_row);
    END IF;

    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', true);
    SELECT * INTO v_row FROM public.get_card_payments_month();
    IF v_row.collected <> 0 OR v_row.payment_count <> 0 OR v_row.unsettled_count <> 0 THEN
        RAISE EXCEPTION 'A coach without Stripe must see zero, never payments without a destination: %', row_to_json(v_row);
    END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000dd', true);
SELECT pg_temp.expect_error('SELECT * FROM public.get_card_payments_month()');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
SELECT pg_temp.expect_error('SELECT * FROM public.get_card_payments_month()');
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT pg_temp.expect_error('SELECT * FROM public.get_card_payments_month()');
RESET ROLE;

SET LOCAL ROLE anon;
SELECT pg_temp.expect_error('SELECT * FROM public.get_card_payments_month()');
RESET ROLE;

DO $$
BEGIN
    IF has_function_privilege('anon', 'public.get_card_payments_month()', 'EXECUTE') THEN
        RAISE EXCEPTION 'anon must not execute get_card_payments_month';
    END IF;
END;
$$;
ROLLBACK;
