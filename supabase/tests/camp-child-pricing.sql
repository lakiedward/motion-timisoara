\set ON_ERROR_STOP on
BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN BYPASSRLS;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

CREATE TABLE public.camps (
    id UUID PRIMARY KEY,
    pricing_mode TEXT NOT NULL,
    price BIGINT NOT NULL,
    period_start DATE NOT NULL
);
CREATE TABLE public.children (
    id UUID PRIMARY KEY,
    parent_id UUID NOT NULL,
    birth_date DATE NOT NULL
);
CREATE TABLE public.camp_age_prices (
    camp_id UUID NOT NULL REFERENCES public.camps(id),
    age_from INTEGER NOT NULL,
    age_to INTEGER NOT NULL,
    amount BIGINT NOT NULL
);

ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_age_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_children ON public.children FOR SELECT TO authenticated
    USING (parent_id = current_setting('request.jwt.claim.sub', true)::UUID);
CREATE POLICY public_prices ON public.camp_age_prices FOR SELECT TO anon, authenticated
    USING (true);
GRANT SELECT ON public.camps, public.children, public.camp_age_prices
    TO anon, authenticated, service_role;

INSERT INTO public.camps VALUES
    ('00000000-0000-0000-0000-000000000001', 'by_age', 99999, '2026-10-01'),
    ('00000000-0000-0000-0000-000000000002', 'single', 25000, '2026-10-01');
INSERT INTO public.camp_age_prices VALUES
    ('00000000-0000-0000-0000-000000000001', 6, 9, 12000),
    ('00000000-0000-0000-0000-000000000001', 10, 12, 18000);
INSERT INTO public.children VALUES
    ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000101', '2016-10-02'),
    ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000101', '2016-10-01'),
    ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000102', '2020-10-01'),
    ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000102', '2014-10-01'),
    ('00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000102', '2013-10-01');

\i /tmp/camp-pricing-functions.sql

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000101';
SET LOCAL ROLE authenticated;
DO $$
BEGIN
    IF EXISTS (SELECT FROM public.children WHERE parent_id <> current_setting('request.jwt.claim.sub')::UUID) THEN
        RAISE EXCEPTION 'Fixture RLS must hide foreign children';
    END IF;
    IF public.pret_tabara_pentru_copil('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013') IS DISTINCT FROM 12000::BIGINT THEN
        RAISE EXCEPTION 'Baseline must reproduce foreign-child RPC exposure';
    END IF;
END
$$;
RESET ROLE;

\i /tmp/camp-pricing-restriction.sql
\i /tmp/camp-pricing-restriction.sql

DO $$
BEGIN
    IF has_function_privilege('anon', 'public.pret_tabara_pentru_copil(uuid,uuid)', 'EXECUTE')
        OR has_function_privilege('authenticated', 'public.pret_tabara_pentru_copil(uuid,uuid)', 'EXECUTE')
        OR NOT has_function_privilege('service_role', 'public.pret_tabara_pentru_copil(uuid,uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'Effective function privileges are incorrect';
    END IF;
    IF EXISTS (
        SELECT FROM pg_proc p, LATERAL aclexplode(p.proacl) a
        WHERE p.oid = 'public.pret_tabara_pentru_copil(uuid,uuid)'::REGPROCEDURE
            AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'PUBLIC retains execution privilege';
    END IF;
END
$$;

SET LOCAL ROLE anon;
DO $$
BEGIN
    PERFORM public.pret_tabara_pentru_copil('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013');
    RAISE EXCEPTION 'Anonymous RPC execution must fail';
EXCEPTION WHEN insufficient_privilege THEN
    NULL;
END
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
    child_id UUID;
BEGIN
    FOREACH child_id IN ARRAY ARRAY[
        '00000000-0000-0000-0000-000000000011'::UUID,
        '00000000-0000-0000-0000-000000000013'::UUID
    ] LOOP
        BEGIN
            PERFORM public.pret_tabara_pentru_copil('00000000-0000-0000-0000-000000000001', child_id);
            RAISE EXCEPTION 'Authenticated RPC execution must fail for own and foreign children';
        EXCEPTION WHEN insufficient_privilege THEN
            NULL;
        END;
    END LOOP;
END
$$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $$
DECLARE
    scenario RECORD;
    actual BIGINT;
BEGIN
    FOR scenario IN
        SELECT * FROM (VALUES
            ('before birthday', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 12000::BIGINT),
            ('birthday at camp start', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 18000::BIGINT),
            ('inclusive lower age', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013', 12000::BIGINT),
            ('inclusive upper age', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000014', 18000::BIGINT),
            ('unmatched age', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000015', NULL::BIGINT),
            ('single price outside age categories', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000015', 25000::BIGINT),
            ('missing child', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000099', NULL::BIGINT),
            ('missing camp', '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000011', NULL::BIGINT)
        ) AS cases(label, camp_id, child_id, expected)
    LOOP
        actual := public.pret_tabara_pentru_copil(scenario.camp_id::UUID, scenario.child_id::UUID);
        IF actual IS DISTINCT FROM scenario.expected THEN
            RAISE EXCEPTION 'Pricing scenario %: expected %, got %', scenario.label, scenario.expected, actual;
        END IF;
    END LOOP;
END
$$;
RESET ROLE;
ROLLBACK;
\echo 'PASS: migration idempotency, RLS exposure baseline, effective grants, denied client calls, eight service-role pricing cases'
