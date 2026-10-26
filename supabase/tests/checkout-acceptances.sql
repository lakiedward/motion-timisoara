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

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY,
    role TEXT NOT NULL
);
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

CREATE TABLE public.enrollments_probe (id UUID PRIMARY KEY);
GRANT SELECT, INSERT ON public.enrollments_probe TO service_role;

CREATE FUNCTION public.save_enrollment_batch(
    p_parent_id UUID, p_kind TEXT, p_entity_id UUID, p_method TEXT, p_quotes JSONB, p_billing JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_ids UUID[] := ARRAY[gen_random_uuid(), gen_random_uuid()];
BEGIN
    INSERT INTO public.enrollments_probe SELECT unnest(v_ids);
    RETURN jsonb_build_object('enrollmentId', v_ids[1], 'enrollmentIds', to_jsonb(v_ids), 'requiresPaymentIntent', false);
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_enrollment_batch(UUID, TEXT, UUID, TEXT, JSONB, JSONB) TO service_role;

\i /tmp/migrations/00102_checkout_acceptances.sql

INSERT INTO public.profiles (id, role) VALUES
    ('00000000-0000-0000-0000-000000000001', 'PARENT'),
    ('00000000-0000-0000-0000-000000000002', 'PARENT'),
    ('00000000-0000-0000-0000-0000000000a1', 'ADMIN');

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
GRANT EXECUTE ON FUNCTION pg_temp.expect_error(text) TO anon, authenticated, service_role;

SET LOCAL ROLE service_role;
DO $$
DECLARE
    v_result JSONB;
    v_row public.checkout_acceptances;
BEGIN
    v_result := public.save_enrollment_batch_with_acceptance(
        '00000000-0000-0000-0000-000000000001', 'CAMP', '00000000-0000-0000-0000-00000000ca01', 'CARD',
        '[]'::jsonb, NULL,
        jsonb_build_object(
            'termsVersion', '1.0',
            'termsSha256', repeat('a', 64),
            'clientTermsVersion', '1.0',
            'rulesSource', 'FILE',
            'rulesFilePath', 'club/camp/regulament.pdf',
            'rulesFileName', 'regulament.pdf',
            'rulesSha256', repeat('b', 64)
        )
    );
    SELECT * INTO v_row FROM public.checkout_acceptances;
    IF v_row.enrollment_ids IS DISTINCT FROM ARRAY(SELECT jsonb_array_elements_text(v_result -> 'enrollmentIds')::uuid) THEN
        RAISE EXCEPTION 'Enrollment ids were not recorded';
    END IF;
    IF v_row.user_id <> '00000000-0000-0000-0000-000000000001' OR v_row.terms_version <> '1.0'
       OR v_row.rules_sha256 <> repeat('b', 64) OR v_row.accepted_at IS NULL THEN
        RAISE EXCEPTION 'Acceptance row is incomplete: %', row_to_json(v_row);
    END IF;

    PERFORM public.save_enrollment_batch_with_acceptance(
        '00000000-0000-0000-0000-000000000002', 'COURSE', '00000000-0000-0000-0000-00000000c001', 'CASH',
        '[]'::jsonb, NULL,
        jsonb_build_object('termsVersion', '1.0', 'termsSha256', repeat('a', 64))
    );

    PERFORM pg_temp.expect_error($q$SELECT public.save_enrollment_batch_with_acceptance(
        '00000000-0000-0000-0000-000000000001', 'CAMP', '00000000-0000-0000-0000-00000000ca01', 'CARD',
        '[]'::jsonb, NULL, NULL)$q$);
    PERFORM pg_temp.expect_error($q$SELECT public.save_enrollment_batch_with_acceptance(
        '00000000-0000-0000-0000-000000000001', 'CAMP', '00000000-0000-0000-0000-00000000ca01', 'CARD',
        '[]'::jsonb, NULL, '{"termsVersion":"1.0","termsSha256":"nu-e-hash"}'::jsonb)$q$);
    PERFORM pg_temp.expect_error($q$SELECT public.save_enrollment_batch_with_acceptance(
        '00000000-0000-0000-0000-000000000001', 'CAMP', '00000000-0000-0000-0000-00000000ca01', 'CARD',
        '[]'::jsonb, NULL, jsonb_build_object('termsVersion', '1.0', 'termsSha256', repeat('a', 64), 'rulesSource', 'FILE', 'rulesSha256', repeat('b', 64)))$q$);

    IF (SELECT count(*) FROM public.enrollments_probe) <> 4 THEN
        RAISE EXCEPTION 'A refused acceptance left enrollments behind';
    END IF;
    IF (SELECT count(*) FROM public.checkout_acceptances) <> 2 THEN
        RAISE EXCEPTION 'Expected exactly two acceptance rows';
    END IF;

    PERFORM pg_temp.expect_error($q$UPDATE public.checkout_acceptances SET terms_version = '9.9'$q$);
    PERFORM pg_temp.expect_error($q$DELETE FROM public.checkout_acceptances$q$);
END;
$$;
RESET ROLE;

DO $$
BEGIN
    PERFORM pg_temp.expect_error($q$UPDATE public.checkout_acceptances SET terms_version = '9.9'$q$);
    PERFORM pg_temp.expect_error($q$DELETE FROM public.checkout_acceptances$q$);
    PERFORM pg_temp.expect_error($q$DELETE FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001'$q$);
END;
$$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
DO $$
BEGIN
    IF (SELECT count(*) FROM public.checkout_acceptances) <> 1 THEN
        RAISE EXCEPTION 'Parent does not see exactly their own acceptance';
    END IF;
    PERFORM pg_temp.expect_error($q$INSERT INTO public.checkout_acceptances (user_id, kind, entity_id, enrollment_ids, payment_method, terms_version, terms_sha256)
        VALUES ('00000000-0000-0000-0000-000000000001', 'CAMP', gen_random_uuid(), ARRAY[gen_random_uuid()], 'CARD', '1.0', repeat('a', 64))$q$);
    PERFORM pg_temp.expect_error($q$UPDATE public.checkout_acceptances SET terms_version = '9.9'$q$);
    PERFORM pg_temp.expect_error($q$DELETE FROM public.checkout_acceptances$q$);
    PERFORM pg_temp.expect_error($q$SELECT public.save_enrollment_batch_with_acceptance(
        '00000000-0000-0000-0000-000000000001', 'CAMP', '00000000-0000-0000-0000-00000000ca01', 'CARD',
        '[]'::jsonb, NULL, jsonb_build_object('termsVersion', '1.0', 'termsSha256', repeat('a', 64)))$q$);
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
DO $$
BEGIN
    IF (SELECT count(*) FROM public.checkout_acceptances) <> 2 THEN
        RAISE EXCEPTION 'ADMIN does not see every acceptance';
    END IF;
END;
$$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $$
BEGIN
    PERFORM pg_temp.expect_error($q$SELECT count(*) FROM public.checkout_acceptances$q$);
    PERFORM pg_temp.expect_error($q$SELECT public.save_enrollment_batch_with_acceptance(
        '00000000-0000-0000-0000-000000000001', 'CAMP', '00000000-0000-0000-0000-00000000ca01', 'CARD',
        '[]'::jsonb, NULL, jsonb_build_object('termsVersion', '1.0', 'termsSha256', repeat('a', 64)))$q$);
END;
$$;
RESET ROLE;

ROLLBACK;
\echo 'checkout-acceptances: OK'
