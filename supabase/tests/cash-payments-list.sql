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

CREATE TABLE public.profiles (id UUID PRIMARY KEY, role TEXT NOT NULL, name TEXT);
CREATE TABLE public.clubs (id UUID PRIMARY KEY, owner_user_id UUID);
CREATE TABLE public.courses (id UUID PRIMARY KEY, name TEXT, coach_id UUID, club_id UUID);
CREATE TABLE public.activities (id UUID PRIMARY KEY, name TEXT, coach_id UUID, club_id UUID);
CREATE TABLE public.camps (id UUID PRIMARY KEY, title TEXT, coach_id UUID, club_id UUID);
CREATE TABLE public.children (id UUID PRIMARY KEY, parent_id UUID, name TEXT);
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY, kind TEXT, entity_id UUID, child_id UUID, adult_profile_id UUID, status TEXT
);
CREATE TABLE public.payments (
    id UUID PRIMARY KEY, enrollment_id UUID, method TEXT, amount BIGINT, currency TEXT, status TEXT,
    pricing_snapshot JSONB, created_at TIMESTAMPTZ DEFAULT now(), paid_at TIMESTAMPTZ
);

\i /tmp/migrations/00104_cash_payments_list.sql

INSERT INTO public.profiles (id, role, name) VALUES
    ('00000000-0000-0000-0000-0000000000c1', 'COACH', 'Antrenor club'),
    ('00000000-0000-0000-0000-0000000000c2', 'COACH', 'Alt antrenor'),
    ('00000000-0000-0000-0000-0000000000b1', 'CLUB', 'Club'),
    ('00000000-0000-0000-0000-0000000000b2', 'CLUB', 'Alt club'),
    ('00000000-0000-0000-0000-0000000000a1', 'ADMIN', 'Admin'),
    ('00000000-0000-0000-0000-0000000000dd', 'PARENT', 'Părinte'),
    ('00000000-0000-0000-0000-0000000000d1', 'PARENT', 'Adult înscris');
INSERT INTO public.clubs VALUES
    ('00000000-0000-0000-0000-00000000cb01', '00000000-0000-0000-0000-0000000000b1'),
    ('00000000-0000-0000-0000-00000000cb02', '00000000-0000-0000-0000-0000000000b2');
INSERT INTO public.courses VALUES
    ('00000000-0000-0000-0000-00000000c001', 'Înot club', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000cb01'),
    ('00000000-0000-0000-0000-00000000c002', 'Atletism independent', '00000000-0000-0000-0000-0000000000c2', NULL);
INSERT INTO public.activities VALUES
    ('00000000-0000-0000-0000-00000000ac01', 'Tură club', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000cb01');
INSERT INTO public.camps VALUES
    ('00000000-0000-0000-0000-00000000ca01', 'Tabără alt club', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000cb02');
INSERT INTO public.children VALUES
    ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000dd', 'Ana');
INSERT INTO public.enrollments VALUES
    ('00000000-0000-0000-0000-000000000e01', 'COURSE', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000e1', NULL, 'PENDING'),
    ('00000000-0000-0000-0000-000000000e02', 'COURSE', '00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000e1', NULL, 'ACTIVE'),
    ('00000000-0000-0000-0000-000000000e03', 'ACTIVITY', '00000000-0000-0000-0000-00000000ac01', NULL, '00000000-0000-0000-0000-0000000000d1', 'PENDING'),
    ('00000000-0000-0000-0000-000000000e04', 'CAMP', '00000000-0000-0000-0000-00000000ca01', '00000000-0000-0000-0000-0000000000e1', NULL, 'PENDING'),
    ('00000000-0000-0000-0000-000000000e05', 'COURSE', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000e1', NULL, 'CANCELLED'),
    ('00000000-0000-0000-0000-000000000e06', 'COURSE', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000e1', NULL, 'ACTIVE'),
    ('00000000-0000-0000-0000-000000000e07', 'COURSE', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000e1', NULL, 'ACTIVE');
INSERT INTO public.payments (id, enrollment_id, method, amount, currency, status, pricing_snapshot, paid_at) VALUES
    ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000e01', 'CASH', 40000, 'RON', 'PENDING', '{"quantity": 8}', NULL),
    ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000e02', 'CASH', 30000, 'RON', 'SUCCEEDED', '{"quantity": 4}', now() - INTERVAL '1 day'),
    ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000e03', 'CASH', 5000, 'RON', 'PENDING', NULL, NULL),
    ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000e04', 'CASH', 120000, 'RON', 'PENDING', NULL, NULL),
    ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-000000000e05', 'CASH', 40000, 'RON', 'PENDING', '{"quantity": 8}', NULL),
    ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-000000000e06', 'CARD', 40000, 'RON', 'PENDING', '{"quantity": 8}', NULL),
    ('00000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-000000000e07', 'CASH', 40000, 'RON', 'SUCCEEDED', '{"quantity": 8}', now() - INTERVAL '120 days');

CREATE FUNCTION pg_temp.payment_ids(p_user UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_ids TEXT;
BEGIN
    PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
    SELECT string_agg(right(payment_id::text, 2), ',' ORDER BY payment_id) INTO v_ids
    FROM public.get_cash_payments();
    RETURN COALESCE(v_ids, '');
END;
$$;
GRANT EXECUTE ON FUNCTION pg_temp.payment_ids(UUID) TO authenticated;

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

SET LOCAL ROLE authenticated;
DO $$
DECLARE
    v_row RECORD;
BEGIN
    IF pg_temp.payment_ids('00000000-0000-0000-0000-0000000000c1') <> 'f1,f4' THEN
        RAISE EXCEPTION 'Coach must see only the cash payments of their own offers: %',
            pg_temp.payment_ids('00000000-0000-0000-0000-0000000000c1');
    END IF;
    IF pg_temp.payment_ids('00000000-0000-0000-0000-0000000000c2') <> 'f2,f3' THEN
        RAISE EXCEPTION 'Second coach list is wrong: %',
            pg_temp.payment_ids('00000000-0000-0000-0000-0000000000c2');
    END IF;
    IF pg_temp.payment_ids('00000000-0000-0000-0000-0000000000b1') <> 'f1,f3' THEN
        RAISE EXCEPTION 'Club must see its course and activity, not another club camp: %',
            pg_temp.payment_ids('00000000-0000-0000-0000-0000000000b1');
    END IF;
    IF pg_temp.payment_ids('00000000-0000-0000-0000-0000000000b2') <> 'f4' THEN
        RAISE EXCEPTION 'Other club must see only its camp: %',
            pg_temp.payment_ids('00000000-0000-0000-0000-0000000000b2');
    END IF;
    IF pg_temp.payment_ids('00000000-0000-0000-0000-0000000000a1') <> 'f1,f2,f3,f4' THEN
        RAISE EXCEPTION 'ADMIN must see every current cash payment: %',
            pg_temp.payment_ids('00000000-0000-0000-0000-0000000000a1');
    END IF;

    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
    SELECT * INTO v_row FROM public.get_cash_payments() WHERE right(payment_id::text, 2) = 'f1';
    IF v_row.kind <> 'COURSE' OR v_row.offer_title <> 'Înot club' OR v_row.participant_name <> 'Ana'
       OR v_row.is_adult OR v_row.sessions <> 8 OR v_row.amount <> 40000 OR v_row.status <> 'PENDING' THEN
        RAISE EXCEPTION 'Course row is incomplete: %', row_to_json(v_row);
    END IF;
    SELECT * INTO v_row FROM public.get_cash_payments() WHERE right(payment_id::text, 2) = 'f3';
    IF v_row.participant_name <> 'Adult înscris' OR NOT v_row.is_adult OR v_row.sessions IS NOT NULL THEN
        RAISE EXCEPTION 'Adult activity row is incomplete: %', row_to_json(v_row);
    END IF;
    IF (SELECT right(payment_id::text, 2) FROM public.get_cash_payments() LIMIT 1) = 'f2' THEN
        RAISE EXCEPTION 'Pending payments must come before confirmed ones';
    END IF;

    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000dd', true);
    PERFORM pg_temp.expect_error($q$SELECT * FROM public.get_cash_payments()$q$);
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM pg_temp.expect_error($q$SELECT * FROM public.get_cash_payments()$q$);
END;
$$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $$
BEGIN
    PERFORM pg_temp.expect_error($q$SELECT * FROM public.get_cash_payments()$q$);
END;
$$;
RESET ROLE;

ROLLBACK;
\echo 'cash-payments-list: OK'
