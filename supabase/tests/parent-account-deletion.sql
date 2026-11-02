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

CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY);
ALTER TABLE auth.users
    ADD COLUMN IF NOT EXISTS email VARCHAR,
    ADD COLUMN IF NOT EXISTS encrypted_password VARCHAR,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS raw_user_meta_data JSONB,
    ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS auth.identities (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS auth.sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (id BIGSERIAL PRIMARY KEY, user_id VARCHAR);

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, phone TEXT, role TEXT NOT NULL,
    avatar_url TEXT, oauth_provider TEXT, oauth_provider_id TEXT, enabled BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE public.children (
    id UUID PRIMARY KEY, parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL, birth_date DATE NOT NULL, level TEXT, allergies TEXT,
    emergency_contact_name TEXT, emergency_phone TEXT, gdpr_consent_at TIMESTAMPTZ,
    secondary_contact_name TEXT, secondary_phone TEXT, tshirt_size TEXT, photo_storage_path TEXT,
    qr_token TEXT NOT NULL, photo_consent BOOLEAN, pickup_persons TEXT, swim_level TEXT,
    medical_notes TEXT, dietary_restrictions TEXT
);
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY, kind TEXT NOT NULL,
    child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
    adult_profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL
);
CREATE TABLE public.payments (
    id UUID PRIMARY KEY, enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    status TEXT NOT NULL, client_secret TEXT, billing_name TEXT, billing_email TEXT,
    billing_address_line1 TEXT, billing_city TEXT, billing_postal_code TEXT, billing_country TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.monthly_payments (
    id UUID PRIMARY KEY, enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    status TEXT NOT NULL
);
CREATE TABLE public.course_ratings (id UUID PRIMARY KEY, parent_id UUID NOT NULL REFERENCES public.profiles(id));
CREATE TABLE public.coach_ratings (id UUID PRIMARY KEY, parent_id UUID NOT NULL REFERENCES public.profiles(id));
CREATE TABLE public.parent_live_location_consents (id UUID PRIMARY KEY, parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE);
CREATE TABLE public.user_recent_locations (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE);
CREATE TABLE public.user_announcement_views (user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE);
CREATE TABLE public.push_devices (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE);
CREATE TABLE public.push_preferences (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE);
CREATE TABLE public.checkout_acceptances (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT);
CREATE TABLE public.attendance (id UUID PRIMARY KEY, child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE, note TEXT);
CREATE TABLE public.activity_attendance (id UUID PRIMARY KEY, child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE);
CREATE TABLE public.attendance_accounting (id UUID PRIMARY KEY, child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE);
CREATE TABLE public.camp_participation (id UUID PRIMARY KEY, enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE);
CREATE TABLE public.competition_registrations (
    id UUID PRIMARY KEY, enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    adult_profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, adult_birth_date DATE
);

\i /tmp/migrations/00106_parent_account_deletion.sql

INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data) VALUES
    ('00000000-0000-0000-0000-0000000000d1', 'nou@test.ro', 'hash', '{"name": "Nou"}'),
    ('00000000-0000-0000-0000-0000000000d2', 'plata@test.ro', 'hash', '{"name": "Plătitor"}'),
    ('00000000-0000-0000-0000-0000000000c1', 'antrenor@test.ro', 'hash', '{}');
INSERT INTO auth.identities (user_id) VALUES ('00000000-0000-0000-0000-0000000000d1'), ('00000000-0000-0000-0000-0000000000d2');
INSERT INTO auth.sessions (user_id) VALUES ('00000000-0000-0000-0000-0000000000d2');
INSERT INTO auth.refresh_tokens (user_id) VALUES ('00000000-0000-0000-0000-0000000000d2');
INSERT INTO public.profiles (id, email, name, phone, role) VALUES
    ('00000000-0000-0000-0000-0000000000d1', 'nou@test.ro', 'Părinte nou', '0700000001', 'PARENT'),
    ('00000000-0000-0000-0000-0000000000d2', 'plata@test.ro', 'Părinte plătitor', '0700000002', 'PARENT'),
    ('00000000-0000-0000-0000-0000000000c1', 'antrenor@test.ro', 'Antrenor', NULL, 'COACH');
INSERT INTO public.children (id, parent_id, name, birth_date, qr_token, allergies, medical_notes, emergency_phone) VALUES
    ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'Ana', '2016-05-04', 'qr-ana', 'nuci', 'astm', '0711'),
    ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d2', 'Bogdan', '2015-09-12', 'qr-bogdan', 'polen', 'diabet', '0722');
INSERT INTO public.enrollments (id, kind, child_id, adult_profile_id, status) VALUES
    ('00000000-0000-0000-0000-000000000e01', 'COURSE', '00000000-0000-0000-0000-0000000000e1', NULL, 'PENDING'),
    ('00000000-0000-0000-0000-000000000e02', 'COURSE', '00000000-0000-0000-0000-0000000000e2', NULL, 'ACTIVE'),
    ('00000000-0000-0000-0000-000000000e03', 'CAMP', '00000000-0000-0000-0000-0000000000e2', NULL, 'PENDING'),
    ('00000000-0000-0000-0000-000000000e04', 'COMPETITION', NULL, '00000000-0000-0000-0000-0000000000d2', 'ACTIVE');
INSERT INTO public.payments (id, enrollment_id, status, billing_name, client_secret) VALUES
    ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000e01', 'PENDING', 'Părinte nou', 'pi_1'),
    ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000e02', 'SUCCEEDED', 'Părinte plătitor', NULL),
    ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000e03', 'PENDING', 'Părinte plătitor', 'pi_3');
INSERT INTO public.competition_registrations VALUES
    ('00000000-0000-0000-0000-00000000c701', '00000000-0000-0000-0000-000000000e04', '00000000-0000-0000-0000-0000000000d2', '1985-01-01');
INSERT INTO public.course_ratings VALUES
    ('00000000-0000-0000-0000-00000000a701', '00000000-0000-0000-0000-0000000000d1'),
    ('00000000-0000-0000-0000-00000000a702', '00000000-0000-0000-0000-0000000000d2');
INSERT INTO public.coach_ratings VALUES ('00000000-0000-0000-0000-00000000a703', '00000000-0000-0000-0000-0000000000d2');
INSERT INTO public.push_devices VALUES ('00000000-0000-0000-0000-00000000b701', '00000000-0000-0000-0000-0000000000d2');
INSERT INTO public.checkout_acceptances VALUES ('00000000-0000-0000-0000-00000000b801', '00000000-0000-0000-0000-0000000000d2');
INSERT INTO public.attendance VALUES ('00000000-0000-0000-0000-00000000b901', '00000000-0000-0000-0000-0000000000e2', 'Bogdan a venit cu bunica');

DO $$
BEGIN
    IF has_function_privilege('anon', 'public.delete_my_account()', 'EXECUTE') THEN
        RAISE EXCEPTION 'anon must not execute delete_my_account';
    END IF;
    IF NOT has_function_privilege('authenticated', 'public.delete_my_account()', 'EXECUTE') THEN
        RAISE EXCEPTION 'authenticated must execute delete_my_account';
    END IF;
END;
$$;

SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claim.sub', '', true);
DO $$
BEGIN
    PERFORM public.delete_my_account();
    RAISE EXCEPTION 'a call without a user must fail';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
DO $$
BEGIN
    PERFORM public.delete_my_account();
    RAISE EXCEPTION 'a coach must not delete the account from the app';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);
DO $$
DECLARE v_result JSONB := public.delete_my_account();
BEGIN
    IF v_result->>'mode' IS DISTINCT FROM 'deleted' OR (v_result->>'cancelledEnrollments')::INT <> 1 THEN
        RAISE EXCEPTION 'parent without payments must be deleted, got %', v_result;
    END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', true);
DO $$
DECLARE v_result JSONB := public.delete_my_account();
BEGIN
    IF v_result->>'mode' IS DISTINCT FROM 'anonymized' OR (v_result->>'cancelledEnrollments')::INT <> 3 THEN
        RAISE EXCEPTION 'parent with payments must be anonymized, got %', v_result;
    END IF;
END;
$$;

DO $$
BEGIN
    PERFORM public.delete_my_account();
    RAISE EXCEPTION 'a second deletion must fail';
EXCEPTION WHEN no_data_found THEN NULL;
END;
$$;

RESET ROLE;

DO $$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_child public.children%ROWTYPE;
    v_user auth.users%ROWTYPE;
BEGIN
    IF EXISTS (SELECT FROM auth.users WHERE id = '00000000-0000-0000-0000-0000000000d1')
        OR EXISTS (SELECT FROM public.children WHERE id = '00000000-0000-0000-0000-0000000000e1')
        OR EXISTS (SELECT FROM public.payments WHERE id = '00000000-0000-0000-0000-0000000000f1')
        OR EXISTS (SELECT FROM public.course_ratings WHERE id = '00000000-0000-0000-0000-00000000a701') THEN
        RAISE EXCEPTION 'hard deletion left rows behind';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000d2';
    IF v_profile.name <> 'Cont șters' OR v_profile.email <> '00000000-0000-0000-0000-0000000000d2@cont-sters.invalid'
        OR v_profile.phone IS NOT NULL OR v_profile.enabled OR v_profile.deleted_at IS NULL THEN
        RAISE EXCEPTION 'profile not anonymized: %', row_to_json(v_profile);
    END IF;
    SELECT * INTO v_child FROM public.children WHERE id = '00000000-0000-0000-0000-0000000000e2';
    IF v_child.name <> 'Copil șters' OR v_child.birth_date <> '2015-01-01' OR v_child.allergies IS NOT NULL
        OR v_child.medical_notes IS NOT NULL OR v_child.emergency_phone IS NOT NULL OR v_child.qr_token = 'qr-bogdan' THEN
        RAISE EXCEPTION 'child not anonymized: %', row_to_json(v_child);
    END IF;
    IF EXISTS (SELECT FROM public.enrollments WHERE status <> 'CANCELLED') THEN
        RAISE EXCEPTION 'enrollments were not cancelled';
    END IF;
    IF (SELECT billing_name FROM public.payments WHERE id = '00000000-0000-0000-0000-0000000000f2') IS DISTINCT FROM 'Părinte plătitor'
        OR (SELECT status FROM public.payments WHERE id = '00000000-0000-0000-0000-0000000000f2') <> 'SUCCEEDED' THEN
        RAISE EXCEPTION 'a paid invoice record must keep its billing data';
    END IF;
    IF (SELECT row(status, billing_name, client_secret)::TEXT FROM public.payments WHERE id = '00000000-0000-0000-0000-0000000000f3')
        <> '(FAILED,,)' THEN
        RAISE EXCEPTION 'a pending payment must be failed and cleared';
    END IF;
    IF (SELECT note FROM public.attendance WHERE id = '00000000-0000-0000-0000-00000000b901') IS NOT NULL
        OR (SELECT adult_birth_date FROM public.competition_registrations) IS NOT NULL THEN
        RAISE EXCEPTION 'free text and adult birth date must be cleared';
    END IF;
    IF EXISTS (SELECT FROM public.course_ratings) OR EXISTS (SELECT FROM public.coach_ratings)
        OR EXISTS (SELECT FROM public.push_devices) THEN
        RAISE EXCEPTION 'ratings and devices must be deleted';
    END IF;
    IF NOT EXISTS (SELECT FROM public.checkout_acceptances) THEN
        RAISE EXCEPTION 'checkout acceptances must be kept';
    END IF;
    SELECT * INTO v_user FROM auth.users WHERE id = '00000000-0000-0000-0000-0000000000d2';
    IF v_user.email <> v_profile.email OR v_user.encrypted_password <> '' OR v_user.raw_user_meta_data <> '{}'
        OR v_user.banned_until < now() + INTERVAL '99 years' THEN
        RAISE EXCEPTION 'auth user not locked: %', row_to_json(v_user);
    END IF;
    IF EXISTS (SELECT FROM auth.identities WHERE user_id = '00000000-0000-0000-0000-0000000000d2')
        OR EXISTS (SELECT FROM auth.sessions WHERE user_id = '00000000-0000-0000-0000-0000000000d2')
        OR EXISTS (SELECT FROM auth.refresh_tokens WHERE user_id = '00000000-0000-0000-0000-0000000000d2') THEN
        RAISE EXCEPTION 'identities, sessions and refresh tokens must be removed';
    END IF;
    IF (SELECT email FROM auth.users WHERE id = '00000000-0000-0000-0000-0000000000c1') <> 'antrenor@test.ro' THEN
        RAISE EXCEPTION 'another account changed';
    END IF;
END;
$$;

ROLLBACK;
\echo 'parent account deletion: OK'
