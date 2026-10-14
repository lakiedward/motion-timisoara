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

CREATE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')
$$;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon, authenticated;

CREATE FUNCTION public.cheama_purge_expired_media()
RETURNS void
LANGUAGE sql
AS $$ SELECT $$;

CREATE TABLE public.clubs (
    id UUID PRIMARY KEY,
    owner_user_id UUID,
    name TEXT NOT NULL,
    description TEXT,
    logo_storage_path TEXT,
    hero_photo_storage_path TEXT,
    website TEXT,
    phone TEXT,
    email TEXT,
    public_email_consent BOOLEAN NOT NULL DEFAULT false,
    address TEXT,
    city TEXT,
    county TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    stripe_onboarding_complete BOOLEAN,
    stripe_charges_enabled BOOLEAN,
    stripe_payouts_enabled BOOLEAN,
    bank_account TEXT,
    stripe_account_id TEXT
);
CREATE TABLE public.coach_profiles (
    id UUID PRIMARY KEY,
    user_id UUID,
    bio TEXT,
    avatar_url TEXT,
    photo_storage_path TEXT,
    stripe_onboarding_complete BOOLEAN,
    stripe_charges_enabled BOOLEAN,
    stripe_payouts_enabled BOOLEAN,
    bank_account TEXT
);
GRANT SELECT, UPDATE ON public.clubs TO anon, authenticated;
GRANT SELECT ON public.coach_profiles TO anon, authenticated;
REVOKE SELECT ON public.clubs FROM anon;
GRANT SELECT (id, owner_user_id, name, description, logo_storage_path, hero_photo_storage_path, website, phone, email, public_email_consent, address, city, created_at) ON public.clubs TO anon;

\i /tmp/migrations/00035_restrict_billing_columns_to_owner.sql
GRANT SELECT (county, lat, lng) ON public.clubs TO anon, authenticated;
\i /tmp/migrations/00091_club_public_email.sql
\i /tmp/migrations/00092_revoke_anon_club_email.sql
\i /tmp/migrations/00093_admin_clubs.sql
\i /tmp/migrations/00094_revoke_authenticated_club_email.sql

INSERT INTO public.clubs (id, owner_user_id, name, email, public_email_consent) VALUES
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-00000000000a', 'Club Ascuns', 'ascuns@club.test', false),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-00000000000b', 'Club Public', 'public@club.test', true);

SET LOCAL ROLE authenticated;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000cc';
SET LOCAL request.jwt.claim.role = 'PARENT';
DO $$
DECLARE
    v_public TEXT;
BEGIN
    BEGIN
        PERFORM email FROM public.clubs;
        RAISE EXCEPTION 'A parent can read raw club emails';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    SELECT string_agg(coalesce(public_email, '-'), ',' ORDER BY name) INTO v_public FROM public.clubs;
    IF v_public IS DISTINCT FROM '-,public@club.test' THEN
        RAISE EXCEPTION 'Unexpected public emails for a parent: %', v_public;
    END IF;
    BEGIN
        PERFORM * FROM public.admin_clubs();
        RAISE EXCEPTION 'A parent can read the admin club list';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
SET LOCAL request.jwt.claim.role = 'CLUB';
DO $$
BEGIN
    BEGIN
        PERFORM email FROM public.clubs WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        RAISE EXCEPTION 'Another club can read a raw club email';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        PERFORM * FROM public.admin_clubs();
        RAISE EXCEPTION 'A club can read the admin club list';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
SET LOCAL request.jwt.claim.role = 'CLUB';
DO $$
DECLARE
    v_email TEXT;
    v_id UUID;
BEGIN
    SELECT email INTO v_email FROM public.my_club();
    IF v_email IS DISTINCT FROM 'ascuns@club.test' THEN
        RAISE EXCEPTION 'The owner lost its own email: %', v_email;
    END IF;
    UPDATE public.clubs SET email = 'nou@club.test', public_email_consent = false
    WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'The owner could not save its email';
    END IF;
    SELECT email INTO v_email FROM public.my_club();
    IF v_email IS DISTINCT FROM 'nou@club.test' THEN
        RAISE EXCEPTION 'The saved email did not persist: %', v_email;
    END IF;
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
SET LOCAL request.jwt.claim.role = 'ADMIN';
DO $$
DECLARE
    v_list TEXT;
BEGIN
    SELECT string_agg(name || ':' || coalesce(email, '-'), ',') INTO v_list FROM public.admin_clubs();
    IF v_list IS DISTINCT FROM 'Club Ascuns:nou@club.test,Club Public:public@club.test' THEN
        RAISE EXCEPTION 'Unexpected admin club list: %', v_list;
    END IF;
END;
$$;

RESET ROLE;
SET LOCAL ROLE anon;
RESET request.jwt.claim.sub;
RESET request.jwt.claim.role;
DO $$
BEGIN
    BEGIN
        PERFORM email FROM public.clubs;
        RAISE EXCEPTION 'Anonymous visitors can read raw club emails';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        PERFORM * FROM public.admin_clubs();
        RAISE EXCEPTION 'Anonymous visitors can call admin_clubs';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    IF (SELECT count(public_email) FROM public.clubs) <> 1 THEN
        RAISE EXCEPTION 'Anonymous visitors lost consented emails';
    END IF;
END;
$$;
RESET ROLE;
ROLLBACK;
