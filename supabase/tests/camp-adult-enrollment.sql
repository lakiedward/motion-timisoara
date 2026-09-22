\set ON_ERROR_STOP on
BEGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE public.profiles(id UUID PRIMARY KEY, role TEXT NOT NULL, name TEXT NOT NULL DEFAULT 'Părinte');
CREATE TABLE public.children(id UUID PRIMARY KEY, parent_id UUID NOT NULL REFERENCES public.profiles(id), birth_date DATE NOT NULL);
CREATE TABLE public.clubs(id UUID PRIMARY KEY, owner_user_id UUID);
CREATE TABLE public.courses(id UUID PRIMARY KEY, currency TEXT NOT NULL, price_per_session BIGINT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true, capacity INTEGER, age_from INTEGER, age_to INTEGER, club_id UUID, coach_id UUID);
CREATE TABLE public.activities(id UUID PRIMARY KEY, currency TEXT NOT NULL, price BIGINT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true, capacity INTEGER, coach_id UUID);
CREATE TABLE public.camps(id UUID PRIMARY KEY, currency TEXT NOT NULL, price BIGINT NOT NULL,
    capacity INTEGER, allow_cash BOOLEAN NOT NULL DEFAULT true, pricing_mode TEXT NOT NULL DEFAULT 'by_age');
CREATE TABLE public.enrollments(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), kind TEXT NOT NULL,
    entity_id UUID NOT NULL, child_id UUID NOT NULL REFERENCES public.children(id), status TEXT NOT NULL DEFAULT 'PENDING',
    purchased_sessions INTEGER NOT NULL DEFAULT 0, remaining_sessions INTEGER NOT NULL DEFAULT 0,
    sessions_used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE public.payments(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), enrollment_id UUID NOT NULL REFERENCES public.enrollments(id),
    method TEXT NOT NULL, amount BIGINT NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING',
    gateway_txn_id TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), paid_at TIMESTAMPTZ,
    billing_name TEXT, billing_email TEXT, billing_address_line1 TEXT, billing_city TEXT, billing_postal_code TEXT, billing_country TEXT);
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE FUNCTION public.get_my_role() RETURNS TEXT LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')
$$;
CREATE FUNCTION public.my_child_ids() RETURNS SETOF UUID LANGUAGE sql STABLE AS $$
    SELECT id FROM public.children WHERE parent_id = auth.uid()
$$;
CREATE FUNCTION public.pot_administra_tabara(p_camp_id UUID) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
    SELECT true
$$;
CREATE FUNCTION public.pot_vedea_inscrierile_taberei(p_camp_id UUID) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
    SELECT true
$$;
CREATE FUNCTION public.componentele_categoriei_valide(p_components JSONB) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    SELECT jsonb_typeof(p_components) = 'array'
       AND jsonb_array_length(p_components) >= 1
       AND NOT EXISTS (
           SELECT 1 FROM jsonb_array_elements(p_components) AS c
           WHERE jsonb_typeof(c) IS DISTINCT FROM 'object'
              OR coalesce(btrim(c->>'name'), '') = ''
              OR jsonb_typeof(c->'amount') IS DISTINCT FROM 'number'
              OR (c->>'amount')::NUMERIC NOT BETWEEN 0 AND 9007199254740991
              OR trunc((c->>'amount')::NUMERIC) <> (c->>'amount')::NUMERIC
       );
$$;
CREATE FUNCTION public.suma_componentelor_categoriei(p_components JSONB) RETURNS BIGINT
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    SELECT coalesce(sum(
        CASE WHEN jsonb_typeof(c->'amount') = 'number'
                 AND (c->>'amount')::NUMERIC BETWEEN 0 AND 9007199254740991
                 AND trunc((c->>'amount')::NUMERIC) = (c->>'amount')::NUMERIC
            THEN (c->>'amount')::BIGINT ELSE 0 END
    ), 0)
    FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(p_components) = 'array' THEN p_components ELSE '[]'::jsonb END
    ) AS c;
$$;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
\i /tmp/migrations/00048_enrollment_price_snapshots.sql
\i /tmp/migrations/00050_atomic_enrollment_payment_completion.sql
CREATE FUNCTION public.enrollment_camp_offer(p_camp_id UUID,p_child_id UUID) RETURNS JSONB
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
    SELECT jsonb_build_object('amount',price,'currency',currency,'eur_ron_rate_micros',eur_ron_rate_micros)
    FROM public.camps WHERE id=p_camp_id
$$;
GRANT EXECUTE ON FUNCTION public.enrollment_camp_offer(UUID, UUID) TO service_role;
\i /tmp/migrations/00060_atomic_enrollment_creation.sql
\i /tmp/migrations/00061_free_enrollment_fulfillment.sql
\i /tmp/migrations/00068_camp_adult_enrollment.sql
CREATE FUNCTION public.test_uuid(v INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-0000-0000-' || lpad(v::TEXT,12,'0'))::UUID
$$;
CREATE FUNCTION public.test_assert(ok BOOLEAN,label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',label; END IF; END;
$$;
CREATE FUNCTION public.test_child_quote(v_child INTEGER, v_unit BIGINT DEFAULT 8000)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT jsonb_build_object('childId',public.test_uuid(v_child),'amount',v_unit,'currency','RON','priceVersion',repeat('a',64),
        'snapshot',jsonb_build_object('schemaVersion',1,'kind','CAMP','entityId',public.test_uuid(120),
            'childId',public.test_uuid(v_child),'sourceUnitAmount',v_unit,'sourceCurrency','RON','quantity',1,
            'eurRonRateMicros',null,'amount',v_unit,'currency','RON','priceVersion',repeat('a',64)))
$$;
CREATE FUNCTION public.test_adult_quote(v_adult INTEGER, v_unit BIGINT DEFAULT 15000)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT jsonb_build_object('adultProfileId',public.test_uuid(v_adult),'amount',v_unit,'currency','RON','priceVersion',repeat('b',64),
        'snapshot',jsonb_build_object('schemaVersion',1,'kind','CAMP','entityId',public.test_uuid(120),
            'childId',null,'adultProfileId',public.test_uuid(v_adult),'sourceUnitAmount',v_unit,'sourceCurrency','RON','quantity',1,
            'eurRonRateMicros',null,'amount',v_unit,'currency','RON','priceVersion',repeat('b',64)))
$$;
INSERT INTO public.profiles VALUES(public.test_uuid(1),'PARENT','Ana Părinte'),(public.test_uuid(2),'PARENT','Alt părinte');
INSERT INTO public.children VALUES(public.test_uuid(200),public.test_uuid(1),'2018-01-01');
INSERT INTO public.camps(id,currency,price,allow_cash,capacity) VALUES(public.test_uuid(120),'RON',8000,true,2);
INSERT INTO public.camp_adult_prices(camp_id,amount,components) VALUES(
    public.test_uuid(120), 15000, jsonb_build_array(jsonb_build_object('name','Participare','amount',15000)));
INSERT INTO public.courses(id,currency,price_per_session) VALUES(public.test_uuid(100),'RON',1000);

SELECT public.test_assert(
    public.enrollment_camp_adult_offer(public.test_uuid(120))->>'amount' = '15000',
    'adult offer reads camp_adult_prices');

SELECT public.test_assert(
    public.valid_enrollment_price_snapshot(
        (public.test_child_quote(200)->'snapshot'), 8000, 'RON'),
    'existing child snapshot still validates');

SELECT public.test_assert(
    public.valid_enrollment_price_snapshot(
        (public.test_adult_quote(1)->'snapshot'), 15000, 'RON'),
    'adult snapshot validates');

SELECT public.test_assert(
    public.valid_enrollment_price_snapshot(
        (public.test_adult_quote(1)->'snapshot') || '{"childId":"00000000-0000-0000-0000-000000000200"}'::jsonb,
        15000, 'RON') IS FALSE,
    'snapshot cannot name both subjects');

SET ROLE service_role;
SELECT public.test_assert(
    (public.save_enrollment_batch(public.test_uuid(1),'CAMP',public.test_uuid(120),'CASH',
        jsonb_build_array(public.test_child_quote(200), public.test_adult_quote(1)))
        ->'enrollmentIds') IS NOT NULL,
    'parent can enroll a child and themselves');

SELECT public.test_assert(
    (SELECT count(*) FROM public.enrollments WHERE entity_id = public.test_uuid(120) AND status = 'PENDING') = 2,
    'child and adult each occupy a seat');

SELECT public.test_assert(
    (SELECT count(*) FROM public.enrollments WHERE adult_profile_id = public.test_uuid(1) AND child_id IS NULL) = 1,
    'adult enrollment has no child_id');

DO $$
DECLARE
    v_state TEXT;
BEGIN
    BEGIN
        PERFORM public.save_enrollment_batch(public.test_uuid(1),'CAMP',public.test_uuid(120),'CASH',
            jsonb_build_array(public.test_adult_quote(1)));
        RAISE EXCEPTION 'duplicate adult must be refused';
    EXCEPTION WHEN check_violation OR unique_violation OR integrity_constraint_violation THEN
        v_state := SQLSTATE;
    END;
    IF v_state IS NULL THEN
        RAISE EXCEPTION 'duplicate adult must be refused';
    END IF;
END;
$$;

UPDATE public.camps SET capacity = 2 WHERE id = public.test_uuid(120);

DO $$
BEGIN
    BEGIN
        PERFORM public.save_enrollment_batch(public.test_uuid(2),'CAMP',public.test_uuid(120),'CASH',
            jsonb_build_array(public.test_adult_quote(2)));
        RAISE EXCEPTION 'third seat must be refused when capacity is 2';
    EXCEPTION WHEN check_violation OR integrity_constraint_violation THEN
        NULL;
    END;
END;
$$;

INSERT INTO public.camps(id,currency,price,allow_cash,capacity) VALUES(public.test_uuid(121),'RON',0,true,1);
INSERT INTO public.camp_adult_prices(camp_id,amount,components) VALUES(
    public.test_uuid(121), 0, jsonb_build_array(jsonb_build_object('name','Participare','amount',0)));

DO $$
DECLARE
    v_quote JSONB;
    v_result JSONB;
BEGIN
    v_quote := jsonb_build_object('adultProfileId',public.test_uuid(1),'amount',0,'currency','RON','priceVersion',repeat('c',64),
        'snapshot',jsonb_build_object('schemaVersion',1,'kind','CAMP','entityId',public.test_uuid(121),
            'childId',null,'adultProfileId',public.test_uuid(1),'sourceUnitAmount',0,'sourceCurrency','RON','quantity',1,
            'eurRonRateMicros',null,'amount',0,'currency','RON','priceVersion',repeat('c',64)));
    v_result := public.save_enrollment_batch(public.test_uuid(1),'CAMP',public.test_uuid(121),'CARD', jsonb_build_array(v_quote));
    IF (SELECT status FROM public.enrollments WHERE entity_id = public.test_uuid(121)) IS DISTINCT FROM 'ACTIVE' THEN
        RAISE EXCEPTION 'free adult must activate immediately';
    END IF;
    IF (v_result->>'requiresPaymentIntent')::BOOLEAN IS DISTINCT FROM false THEN
        RAISE EXCEPTION 'free adult must not require a card intent';
    END IF;
END;
$$;

DO $$
BEGIN
    BEGIN
        INSERT INTO public.enrollments(kind,entity_id,child_id,adult_profile_id,status)
        VALUES('COURSE', public.test_uuid(100), NULL, public.test_uuid(1), 'PENDING');
        RAISE EXCEPTION 'course cannot take an adult participant';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
END;
$$;

RESET ROLE;
SELECT public.test_assert(
    NOT has_function_privilege('authenticated','public.enrollment_camp_adult_offer(uuid)','EXECUTE'),
    'adult quote stays service_role only');
SELECT public.test_assert(
    has_table_privilege('anon','public.camp_adult_prices','SELECT'),
    'public can read adult tariffs');
ROLLBACK;
