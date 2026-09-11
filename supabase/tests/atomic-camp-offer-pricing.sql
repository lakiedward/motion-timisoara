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
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
CREATE TABLE public.camps (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL DEFAULT current_setting('request.jwt.claim.sub', true)::UUID,
    club_id UUID,
    coach_id UUID,
    title TEXT,
    slug TEXT UNIQUE,
    description TEXT,
    period_end DATE,
    location_id UUID,
    location_text TEXT,
    capacity INTEGER,
    allow_cash BOOLEAN,
    price BIGINT NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'RON',
    eur_ron_rate_micros BIGINT,
    period_start DATE NOT NULL DEFAULT '2026-10-01'
);
CREATE TABLE public.children (id UUID PRIMARY KEY, birth_date DATE NOT NULL);
CREATE TABLE public.camp_price_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    camp_id UUID NOT NULL REFERENCES public.camps(id),
    name TEXT NOT NULL,
    description TEXT,
    amount BIGINT NOT NULL CHECK (amount >= 0),
    display_order INT NOT NULL DEFAULT 0
);
CREATE FUNCTION public.pot_administra_tabara(p_camp_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (SELECT FROM public.camps WHERE id = p_camp_id
        AND owner_id = current_setting('request.jwt.claim.sub', true)::UUID)
$$;
ALTER TABLE public.camps ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_camps ON public.camps FOR SELECT TO authenticated USING (true);
CREATE POLICY own_camps ON public.camps FOR UPDATE TO authenticated
    USING (public.pot_administra_tabara(id)) WITH CHECK (public.pot_administra_tabara(id));
CREATE POLICY create_own_camps ON public.camps FOR INSERT TO authenticated
    WITH CHECK (coach_id = current_setting('request.jwt.claim.sub', true)::UUID AND club_id IS NULL);
GRANT SELECT, INSERT, UPDATE ON public.camps TO authenticated;
GRANT SELECT ON public.camp_price_items TO authenticated;
\i /tmp/migrations/00031_camp_price_breakdown_guard.sql
\i /tmp/migrations/00037_camp_age_pricing.sql
\i /tmp/migrations/00038_camp_age_pricing_trigger_fix.sql
\i /tmp/migrations/00049_atomic_camp_offer_pricing.sql
\i /tmp/migrations/00052_atomic_camp_enrollment_quote.sql
\i /tmp/migrations/00054_atomic_camp_form_save.sql
GRANT SELECT ON public.camps,public.children,public.camp_age_prices TO service_role;
INSERT INTO public.children VALUES ('00000000-0000-0000-0000-000000000201','2018-10-01');
INSERT INTO public.camps(id, owner_id) VALUES
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101');
DO $$
BEGIN
    IF has_function_privilege('anon', 'public.save_camp_offer_pricing(uuid,bigint,text,bigint,jsonb,text,jsonb)', 'EXECUTE')
        OR has_function_privilege('service_role', 'public.save_camp_offer_pricing(uuid,bigint,text,bigint,jsonb,text,jsonb)', 'EXECUTE')
        OR NOT has_function_privilege('authenticated', 'public.save_camp_offer_pricing(uuid,bigint,text,bigint,jsonb,text,jsonb)', 'EXECUTE') THEN
        RAISE EXCEPTION 'Incorrect function privileges';
    END IF;
END;
$$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000102';
DO $$
BEGIN
    BEGIN
        PERFORM public.save_camp_offer_pricing('00000000-0000-0000-0000-000000000001', 10000, 'EUR', 5000000, '[]', 'single', '[]');
        RAISE EXCEPTION 'Foreign organizer must be refused';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000101';
SELECT public.save_camp_offer_pricing('00000000-0000-0000-0000-000000000001', 10000, 'EUR', 5000000,
    '[{"name":"Transport","amount":3000},{"name":"Cazare","amount":7000}]', 'by_age',
    '[{"age_from":6,"age_to":9,"amount":8000},{"age_from":10,"age_to":15,"amount":10000}]');
SET CONSTRAINTS ALL IMMEDIATE;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$
BEGIN
    IF public.enrollment_camp_offer('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000201')
        IS DISTINCT FROM '{"amount":8000,"currency":"EUR","eur_ron_rate_micros":5000000}'::JSONB THEN
        RAISE EXCEPTION 'Camp quote must read age amount and currency/rate together';
    END IF;
    IF has_function_privilege('authenticated','public.enrollment_camp_offer(uuid,uuid)','EXECUTE')
        OR has_function_privilege('anon','public.enrollment_camp_offer(uuid,uuid)','EXECUTE') THEN
        RAISE EXCEPTION 'Child pricing RPC must remain backend-only';
    END IF;
END;
$$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$
DECLARE
    initial_camp JSONB;
    initial_breakdown JSONB;
    initial_ages JSONB;
    scenario RECORD;
BEGIN
    SELECT to_jsonb(c) INTO initial_camp FROM public.camps c;
    SELECT jsonb_agg(c ORDER BY display_order) INTO initial_breakdown FROM public.camp_price_items c;
    SELECT jsonb_agg(c ORDER BY display_order) INTO initial_ages FROM public.camp_age_prices c;
    IF initial_camp->>'currency' <> 'EUR' OR initial_camp->>'eur_ron_rate_micros' <> '5000000'
        OR initial_camp->>'price' <> '10000' OR initial_camp->>'pricing_mode' <> 'by_age'
        OR jsonb_array_length(initial_breakdown) <> 2 OR jsonb_array_length(initial_ages) <> 2 THEN
        RAISE EXCEPTION 'Complete EUR offer was not saved';
    END IF;
    FOR scenario IN SELECT * FROM (VALUES
        ('overlapping ages', 'RON'::TEXT, NULL::BIGINT, '[]'::JSONB, '[{"age_from":6,"age_to":9,"amount":8000},{"age_from":9,"age_to":15,"amount":10000}]'::JSONB, 'P0001'),
        ('missing ages', 'RON', NULL, '[]', '[]', 'P0001'),
        ('wrong breakdown sum', 'RON', NULL, '[{"name":"Wrong","amount":99}]', '[{"age_from":6,"age_to":15,"amount":10000}]', 'P0001'),
        ('missing EUR rate', 'EUR', NULL, '[]', '[]', '22023'),
        ('rate on RON', 'RON', 5000000, '[]', '[]', '22023'),
        ('fractional minor units', 'EUR', 5000000, '[{"name":"Wrong","amount":1.2}]', '[]', '22023'),
        ('unsafe age amount', 'EUR', 5000000, '[]', '[{"age_from":6,"age_to":15,"amount":9007199254740992}]', '22023')
    ) AS cases(label, currency, rate, breakdown, ages, expected_state)
    LOOP
        BEGIN
            PERFORM public.save_camp_offer_pricing('00000000-0000-0000-0000-000000000001', 20000,
                scenario.currency, scenario.rate, scenario.breakdown, 'by_age', scenario.ages);
            RAISE EXCEPTION 'Unexpected success: %', scenario.label USING ERRCODE = 'XX000';
        EXCEPTION WHEN OTHERS THEN
            IF SQLSTATE <> scenario.expected_state THEN RAISE; END IF;
        END;
        IF (SELECT to_jsonb(c) FROM public.camps c) IS DISTINCT FROM initial_camp
            OR (SELECT jsonb_agg(c ORDER BY display_order) FROM public.camp_price_items c) IS DISTINCT FROM initial_breakdown
            OR (SELECT jsonb_agg(c ORDER BY display_order) FROM public.camp_age_prices c) IS DISTINCT FROM initial_ages THEN
            RAISE EXCEPTION 'Failed save changed existing offer: %', scenario.label;
        END IF;
    END LOOP;
END;
$$;
SET CONSTRAINTS ALL DEFERRED;
SELECT public.save_camp_offer_pricing('00000000-0000-0000-0000-000000000001', 50000, 'RON', NULL, '[]', 'single', '[]');
SET CONSTRAINTS ALL IMMEDIATE;
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM public.camps WHERE currency = 'RON' AND price = 50000
        AND eur_ron_rate_micros IS NULL AND pricing_mode = 'single')
        OR EXISTS (SELECT FROM public.camp_price_items) OR EXISTS (SELECT FROM public.camp_age_prices) THEN
        RAISE EXCEPTION 'RON switch retained obsolete pricing data';
    END IF;
END;
$$;
DO $$
DECLARE
    metadata JSONB := '{"title":"Atomic camp","slug":"atomic-camp","period_start":"2027-07-10","period_end":"2027-07-17","allow_cash":true}';
    camp_id UUID := '00000000-0000-0000-0000-000000000003';
    owner_id UUID := '00000000-0000-0000-0000-000000000101';
BEGIN
    BEGIN
        PERFORM public.save_camp_offer(camp_id,metadata,NULL,owner_id,12345,'EUR',NULL,'[]','single','[]');
        RAISE EXCEPTION 'Invalid initial offer accepted' USING ERRCODE='XX000';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    IF EXISTS (SELECT FROM public.camps WHERE id=camp_id) THEN RAISE EXCEPTION 'Failed initial save left a camp'; END IF;
    PERFORM public.save_camp_offer(camp_id,metadata,NULL,owner_id,12345,'EUR',5123456,'[]','single','[]');
    PERFORM public.save_camp_offer(camp_id,metadata,NULL,owner_id,12345,'EUR',5123456,'[]','single','[]');
    IF (SELECT count(*) FROM public.camps WHERE id=camp_id AND price=12345 AND currency='EUR' AND title='Atomic camp') <> 1 THEN
        RAISE EXCEPTION 'Repeated save must preserve one complete camp';
    END IF;
    BEGIN
        PERFORM public.save_camp_offer(camp_id,metadata || '{"title":"Must roll back"}',NULL,owner_id,-1,'EUR',5123456,'[]','single','[]');
        RAISE EXCEPTION 'Invalid updated offer accepted' USING ERRCODE='XX000';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    IF NOT EXISTS (SELECT FROM public.camps WHERE id=camp_id AND title='Atomic camp' AND price=12345) THEN
        RAISE EXCEPTION 'Failed pricing update changed metadata';
    END IF;
    IF has_function_privilege('anon','public.save_camp_offer(uuid,jsonb,uuid,uuid,bigint,text,bigint,jsonb,text,jsonb)','EXECUTE') THEN
        RAISE EXCEPTION 'Anonymous camp save allowed';
    END IF;
END;
$$;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000102';
DO $$
BEGIN
    BEGIN
        PERFORM public.save_camp_offer('00000000-0000-0000-0000-000000000003','{}',NULL,
            '00000000-0000-0000-0000-000000000102',1,'RON',NULL,'[]','single','[]');
        RAISE EXCEPTION 'Foreign camp overwritten' USING ERRCODE='XX000';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;
RESET ROLE;
ROLLBACK;
\echo 'Atomic camp pricing: EUR/RON, ownership, grants and rollback verified'
