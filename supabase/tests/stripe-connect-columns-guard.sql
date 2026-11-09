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

CREATE TABLE public.coach_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    bio TEXT,
    stripe_account_id TEXT,
    stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT false,
    stripe_charges_enabled BOOLEAN NOT NULL DEFAULT false,
    stripe_payouts_enabled BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE public.clubs (
    id UUID PRIMARY KEY,
    owner_user_id UUID NOT NULL,
    name TEXT NOT NULL,
    stripe_account_id TEXT,
    stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT false,
    stripe_charges_enabled BOOLEAN NOT NULL DEFAULT false,
    stripe_payouts_enabled BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_profiles, public.clubs TO anon, authenticated, service_role;

INSERT INTO public.coach_profiles VALUES
    ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', 'bio', 'acct_real', true, true, true);
INSERT INTO public.clubs VALUES
    ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000002', 'Club', NULL, false, false, false);

SELECT set_config('migration.sql', pg_read_file('/tmp/migrations/00136_stripe_connect_columns_service_only.sql'), true) IS NOT NULL AS migration_loaded;
DO $$ BEGIN EXECUTE current_setting('migration.sql'); END $$;

DO $$
DECLARE
    v_case RECORD;
    v_blocked BOOLEAN;
BEGIN
    FOR v_case IN
        SELECT * FROM (VALUES
            ('coach_profiles', 'stripe_account_id = ''acct_other'''),
            ('coach_profiles', 'stripe_onboarding_complete = false'),
            ('coach_profiles', 'stripe_charges_enabled = false'),
            ('coach_profiles', 'stripe_payouts_enabled = false'),
            ('clubs', 'stripe_account_id = ''acct_other'''),
            ('clubs', 'stripe_onboarding_complete = true'),
            ('clubs', 'stripe_charges_enabled = true'),
            ('clubs', 'stripe_payouts_enabled = true')
        ) AS t(tbl, assignment)
    LOOP
        DECLARE
            v_role TEXT;
        BEGIN
            FOREACH v_role IN ARRAY ARRAY['authenticated', 'anon'] LOOP
                v_blocked := false;
                BEGIN
                    EXECUTE format('SET LOCAL ROLE %I', v_role);
                    EXECUTE format('UPDATE public.%I SET %s', v_case.tbl, v_case.assignment);
                EXCEPTION WHEN insufficient_privilege THEN
                    v_blocked := true;
                END;
                RESET ROLE;
                IF NOT v_blocked THEN
                    RAISE EXCEPTION '% a putut scrie % în %', v_role, v_case.assignment, v_case.tbl;
                END IF;
            END LOOP;
        END;
    END LOOP;

    SET LOCAL ROLE authenticated;
    UPDATE public.coach_profiles SET bio = 'bio nou', stripe_charges_enabled = true;
    UPDATE public.clubs SET name = 'Club nou';
    INSERT INTO public.clubs VALUES
        ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000002', 'Club 2', 'acct_fals', true, true, true);
    RESET ROLE;
    IF EXISTS (SELECT 1 FROM public.clubs WHERE id = '00000000-0000-0000-0000-0000000000b2'
               AND (stripe_account_id IS NOT NULL OR stripe_onboarding_complete OR stripe_charges_enabled OR stripe_payouts_enabled)) THEN
        RAISE EXCEPTION 'INSERT de client a păstrat date Stripe.';
    END IF;
    IF (SELECT bio FROM public.coach_profiles) <> 'bio nou' OR (SELECT name FROM public.clubs WHERE id = '00000000-0000-0000-0000-0000000000b1') <> 'Club nou' THEN
        RAISE EXCEPTION 'Modificările obișnuite ale proprietarului au fost blocate.';
    END IF;

    SET LOCAL ROLE service_role;
    UPDATE public.coach_profiles SET stripe_account_id = 'acct_nou', stripe_charges_enabled = false;
    UPDATE public.clubs SET stripe_account_id = 'acct_club', stripe_onboarding_complete = true, stripe_charges_enabled = true, stripe_payouts_enabled = true
        WHERE id = '00000000-0000-0000-0000-0000000000b1';
    RESET ROLE;
    IF (SELECT stripe_account_id FROM public.coach_profiles) <> 'acct_nou'
       OR NOT (SELECT stripe_charges_enabled FROM public.clubs WHERE id = '00000000-0000-0000-0000-0000000000b1') THEN
        RAISE EXCEPTION 'service_role nu a putut actualiza datele Stripe.';
    END IF;
END;
$$;

SELECT 'stripe connect columns guard: ok' AS result;
ROLLBACK;
