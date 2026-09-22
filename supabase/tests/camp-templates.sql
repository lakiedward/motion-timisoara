\set ON_ERROR_STOP on
BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END;
$$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID
$$;

CREATE TABLE public.clubs (
    id UUID PRIMARY KEY,
    owner_user_id UUID
);
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY
);
CREATE TABLE public.locations (
    id UUID PRIMARY KEY
);
CREATE TABLE public.camps (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL
);

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT current_setting('request.jwt.claim.role', true)
$$;

CREATE OR REPLACE FUNCTION public.my_club_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.club', true), '')::UUID
$$;

CREATE OR REPLACE FUNCTION public.componentele_categoriei_valide(p_components JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT jsonb_typeof(p_components) = 'array'
       AND jsonb_array_length(p_components) >= 1
       AND NOT EXISTS (
           SELECT 1
           FROM jsonb_array_elements(p_components) AS c
           WHERE jsonb_typeof(c) IS DISTINCT FROM 'object'
              OR coalesce(btrim(c->>'name'), '') = ''
              OR jsonb_typeof(c->'amount') IS DISTINCT FROM 'number'
              OR (c->>'amount')::NUMERIC NOT BETWEEN 0 AND 9007199254740991
              OR trunc((c->>'amount')::NUMERIC) <> (c->>'amount')::NUMERIC
       );
$$;

GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
GRANT SELECT ON public.camps TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_club_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.componentele_categoriei_valide(JSONB) TO authenticated;

\i /tmp/migrations/00070_camp_templates.sql

INSERT INTO public.profiles (id) VALUES
    ('11111111-1111-1111-1111-111111111111'),
    ('22222222-2222-2222-2222-222222222222'),
    ('33333333-3333-3333-3333-333333333333');
INSERT INTO public.clubs (id, owner_user_id) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333');
INSERT INTO public.locations (id) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc');
INSERT INTO public.camps (id, title) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Tabara existenta');

SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('request.jwt.claim.role', 'CLUB', true);
SELECT set_config('request.jwt.claim.club', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SET ROLE authenticated;

DO $$
DECLARE
    v_id UUID;
    v_again UUID;
    v_prices JSONB;
BEGIN
    v_id := public.save_camp_template(
        '  Vara la munte  ',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        NULL,
        'Descriere',
        'Reguli',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'Cabana',
        20,
        TRUE,
        'EUR',
        '[{"name":"Echipament","items":[{"name":"Sac","quantity":1}]}]'::jsonb,
        '[{"age_from":6,"age_to":9,"components":[{"name":"Cazare","amount":40000}]}]'::jsonb
    );
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'save returned null';
    END IF;
    IF (SELECT name FROM public.camp_templates WHERE id = v_id) <> 'Vara la munte' THEN
        RAISE EXCEPTION 'name was not trimmed';
    END IF;
    IF (SELECT currency FROM public.camp_templates WHERE id = v_id) <> 'EUR' THEN
        RAISE EXCEPTION 'currency was not stored';
    END IF;

    v_again := public.save_camp_template(
        'Vara la munte',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        NULL,
        'Descriere noua',
        NULL,
        NULL,
        NULL,
        NULL,
        FALSE,
        'RON',
        '[]'::jsonb,
        '[{"age_from":0,"age_to":2,"components":[{"name":"Participare","amount":0}]},{"age_from":3,"age_to":6,"components":[{"name":"Cazare","amount":10000},{"name":"Masa","amount":5000}]}]'::jsonb
    );
    IF v_again IS DISTINCT FROM v_id THEN
        RAISE EXCEPTION 'same name created a second template';
    END IF;
    IF (SELECT count(*) FROM public.camp_templates) <> 1 THEN
        RAISE EXCEPTION 'replace inserted a duplicate';
    END IF;
    SELECT age_prices INTO v_prices FROM public.camp_templates WHERE id = v_id;
    IF jsonb_array_length(v_prices) <> 2 OR (SELECT description FROM public.camp_templates WHERE id = v_id) <> 'Descriere noua' THEN
        RAISE EXCEPTION 'replace did not update the snapshot';
    END IF;
    IF (SELECT title FROM public.camps) <> 'Tabara existenta' THEN
        RAISE EXCEPTION 'template save changed a camp';
    END IF;
END;
$$;

DO $$
BEGIN
    PERFORM public.save_camp_template(
        'Altul',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        NULL,
        NULL, NULL, NULL, NULL, NULL, FALSE, 'RON', '[]'::jsonb,
        '[{"age_from":6,"age_to":10,"components":[{"name":"Cazare","amount":1}]},{"age_from":8,"age_to":12,"components":[{"name":"Masa","amount":1}]}]'::jsonb
    );
    RAISE EXCEPTION 'overlapping ages were accepted';
EXCEPTION WHEN SQLSTATE 'P0001' THEN
    NULL;
END;
$$;

DO $$
BEGIN
    PERFORM public.save_camp_template(
        '   ',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        NULL,
        NULL, NULL, NULL, NULL, NULL, FALSE, 'RON', '[]'::jsonb,
        '[{"age_from":6,"age_to":9,"components":[{"name":"Cazare","amount":1}]}]'::jsonb
    );
    RAISE EXCEPTION 'blank name was accepted';
EXCEPTION WHEN SQLSTATE 'P0001' THEN
    NULL;
END;
$$;

DO $$
BEGIN
    PERFORM public.save_camp_template(
        'Strain',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        NULL,
        NULL, NULL, NULL, NULL, NULL, FALSE, 'RON', '[]'::jsonb,
        '[{"age_from":6,"age_to":9,"components":[{"name":"Cazare","amount":1}]}]'::jsonb
    );
    RAISE EXCEPTION 'club saved a template for another club';
EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
END;
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
SELECT set_config('request.jwt.claim.role', 'COACH', true);
SELECT set_config('request.jwt.claim.club', '', true);
SET ROLE authenticated;

DO $$
DECLARE
    v_seen INT;
    v_id UUID;
BEGIN
    SELECT count(*) INTO v_seen FROM public.camp_templates;
    IF v_seen <> 0 THEN
        RAISE EXCEPTION 'coach can see a club template';
    END IF;
    v_id := public.save_camp_template(
        'Vara la munte',
        NULL,
        '22222222-2222-2222-2222-222222222222',
        NULL, NULL, NULL, NULL, 8, FALSE, 'RON', '[]'::jsonb,
        '[{"age_from":10,"age_to":12,"components":[{"name":"Antrenamente","amount":25000}]}]'::jsonb
    );
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'coach save failed';
    END IF;
    IF (SELECT count(*) FROM public.camp_templates) <> 1 THEN
        RAISE EXCEPTION 'coach sees more than their own template';
    END IF;
    DELETE FROM public.camp_templates WHERE id = v_id;
    IF (SELECT count(*) FROM public.camp_templates) <> 0 THEN
        RAISE EXCEPTION 'coach delete left a row';
    END IF;
    IF (SELECT title FROM public.camps) <> 'Tabara existenta' THEN
        RAISE EXCEPTION 'deleting a template changed a camp';
    END IF;
END;
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
SELECT set_config('request.jwt.claim.role', 'ADMIN', true);
SELECT set_config('request.jwt.claim.club', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
SET ROLE authenticated;

DO $$
DECLARE
    v_seen INT;
BEGIN
    SELECT count(*) INTO v_seen FROM public.camp_templates;
    IF v_seen <> 0 THEN
        RAISE EXCEPTION 'admin sees another owner template';
    END IF;
    PERFORM public.save_camp_template(
        'Catalog',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        NULL,
        NULL, NULL, NULL, NULL, NULL, FALSE, 'RON', '[]'::jsonb,
        '[{"age_from":6,"age_to":9,"components":[{"name":"Cazare","amount":1}]}]'::jsonb
    );
    RAISE EXCEPTION 'admin saved a club-owned template';
EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
END;
$$;

DO $$
DECLARE
    v_id UUID;
BEGIN
    v_id := public.save_camp_template(
        'Al meu',
        NULL,
        '33333333-3333-3333-3333-333333333333',
        NULL, NULL, NULL, NULL, NULL, FALSE, 'RON', '[]'::jsonb,
        '[{"age_from":6,"age_to":9,"components":[{"name":"Cazare","amount":1}]}]'::jsonb
    );
    IF (SELECT coach_id FROM public.camp_templates WHERE id = v_id) <> '33333333-3333-3333-3333-333333333333' THEN
        RAISE EXCEPTION 'admin template is not owned by the admin account';
    END IF;
    IF (SELECT club_id FROM public.camp_templates WHERE id = v_id) IS NOT NULL THEN
        RAISE EXCEPTION 'admin template has a club owner';
    END IF;
END;
$$;

ROLLBACK;
