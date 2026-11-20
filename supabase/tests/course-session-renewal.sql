\set ON_ERROR_STOP on
BEGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE public.profiles(id UUID PRIMARY KEY, role TEXT NOT NULL, name TEXT NOT NULL DEFAULT 'Părinte');
CREATE TABLE public.clubs(id UUID PRIMARY KEY, owner_user_id UUID);
CREATE TABLE public.children(id UUID PRIMARY KEY, parent_id UUID NOT NULL REFERENCES public.profiles(id), birth_date DATE NOT NULL);
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
    gateway_txn_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ, billing_name TEXT, billing_email TEXT, billing_address_line1 TEXT, billing_city TEXT,
    billing_postal_code TEXT, billing_country TEXT);
CREATE TABLE public.payment_intent_requests(id UUID PRIMARY KEY REFERENCES public.payments(id) ON DELETE CASCADE,
    params JSONB NOT NULL DEFAULT '{}'::JSONB);
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
CREATE FUNCTION public.pot_administra_tabara(p_camp_id UUID) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$ SELECT true $$;
CREATE FUNCTION public.pot_vedea_inscrierile_taberei(p_camp_id UUID) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$ SELECT true $$;
CREATE FUNCTION public.componentele_categoriei_valide(p_components JSONB) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT jsonb_typeof(p_components) = 'array' $$;
CREATE FUNCTION public.suma_componentelor_categoriei(p_components JSONB) RETURNS BIGINT
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT 0::BIGINT $$;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
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
\i /tmp/migrations/00102_checkout_acceptances.sql
CREATE TABLE public.test_inactive_offers(id UUID PRIMARY KEY);
GRANT SELECT, INSERT, DELETE ON public.test_inactive_offers TO service_role;
CREATE FUNCTION public.enrollment_offer_has_access(p_kind TEXT, p_entity_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT NOT EXISTS (SELECT 1 FROM public.test_inactive_offers WHERE id = p_entity_id)
$$;
REVOKE ALL ON FUNCTION public.enrollment_offer_has_access(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enrollment_offer_has_access(TEXT, UUID) TO service_role;
\i /tmp/migrations/00147_course_session_renewal.sql

CREATE FUNCTION public.test_uuid(v INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-0000-0000-' || lpad(v::TEXT,12,'0'))::UUID
$$;
CREATE FUNCTION public.test_assert(ok BOOLEAN,label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',label; END IF; END;
$$;
CREATE FUNCTION public.test_quote(v_child INTEGER, v_quantity INTEGER, v_course INTEGER DEFAULT 100, v_unit BIGINT DEFAULT 1000)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT jsonb_build_object('childId',public.test_uuid(v_child),'amount',v_unit*v_quantity,'currency','RON',
        'priceVersion',repeat('c',64),
        'snapshot',jsonb_build_object('schemaVersion',1,'kind','COURSE','entityId',public.test_uuid(v_course),
            'childId',public.test_uuid(v_child),'sourceUnitAmount',v_unit,'sourceCurrency','RON','quantity',v_quantity,
            'eurRonRateMicros',null,'amount',v_unit*v_quantity,'currency','RON','priceVersion',repeat('c',64)))
$$;
CREATE FUNCTION public.test_acceptance() RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT jsonb_build_object('termsVersion','2026-10-01','termsSha256',repeat('d',64),'clientTermsVersion','2026-10-01')
$$;
CREATE FUNCTION public.test_billing() RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT jsonb_build_object('name','Ana Părinte','email','ana@example.test','addressLine1','Str. Test 1',
        'city','Timișoara','postalCode','300001')
$$;
CREATE FUNCTION public.test_renew(v_parent INTEGER, v_enrollment INTEGER, v_method TEXT, v_quote JSONB)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER AS $$
    SELECT public.start_course_renewal(public.test_uuid(v_parent), public.test_uuid(v_enrollment), v_method, v_quote,
        CASE WHEN v_method = 'CARD' THEN public.test_billing() END, public.test_acceptance())
$$;
CREATE FUNCTION public.test_try_renew(v_parent INTEGER, v_enrollment INTEGER, v_method TEXT, v_quote JSONB)
RETURNS TEXT LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_detail TEXT;
BEGIN
    PERFORM public.test_renew(v_parent, v_enrollment, v_method, v_quote);
    RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    RETURN SQLSTATE || CASE WHEN coalesce(v_detail, '') <> '' THEN ':' || v_detail ELSE '' END;
END;
$$;
CREATE FUNCTION public.test_try_save(v_child INTEGER, v_method TEXT, v_quantity INTEGER)
RETURNS TEXT LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
    PERFORM public.save_enrollment_batch(public.test_uuid(1), 'COURSE', public.test_uuid(100), v_method,
        jsonb_build_array(public.test_quote(v_child, v_quantity)), CASE WHEN v_method = 'CARD' THEN public.test_billing() END);
    RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE || ':' || SQLERRM;
END;
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

INSERT INTO public.profiles VALUES(public.test_uuid(1),'PARENT','Ana Părinte'),(public.test_uuid(2),'PARENT','Alt părinte'),
    (public.test_uuid(3),'COACH','Antrenor');
INSERT INTO public.children VALUES(public.test_uuid(200),public.test_uuid(1),'2018-01-01'),
    (public.test_uuid(201),public.test_uuid(1),'2018-01-01'),(public.test_uuid(202),public.test_uuid(2),'2018-01-01');
INSERT INTO public.courses(id,currency,price_per_session) VALUES(public.test_uuid(100),'RON',1000),
    (public.test_uuid(101),'RON',1000),(public.test_uuid(102),'RON',1000);
INSERT INTO public.enrollments(id,kind,entity_id,child_id,status,purchased_sessions,remaining_sessions,sessions_used) VALUES
    (public.test_uuid(500),'COURSE',public.test_uuid(100),public.test_uuid(200),'ACTIVE',3,0,3),
    (public.test_uuid(501),'COURSE',public.test_uuid(100),public.test_uuid(201),'PENDING',0,0,0),
    (public.test_uuid(502),'COURSE',public.test_uuid(101),public.test_uuid(202),'ACTIVE',2,1,1),
    (public.test_uuid(503),'COURSE',public.test_uuid(102),public.test_uuid(201),'ACTIVE',2,2,0);
INSERT INTO public.payments(id,enrollment_id,method,amount,currency,status,gateway_txn_id,pricing_snapshot,created_at,paid_at)
VALUES(public.test_uuid(600),public.test_uuid(500),'CARD',3000,'RON','SUCCEEDED','pi_first',
    public.test_quote(200,3)->'snapshot', now() - INTERVAL '30 days', now() - INTERVAL '30 days');

SELECT public.test_assert(NOT has_function_privilege('anon','public.start_course_renewal(uuid,uuid,text,jsonb,jsonb,jsonb)','EXECUTE'),
    'anon cannot start a renewal');
SELECT public.test_assert(NOT has_function_privilege('authenticated','public.start_course_renewal(uuid,uuid,text,jsonb,jsonb,jsonb)','EXECUTE'),
    'authenticated cannot start a renewal directly');
SELECT public.test_assert(has_function_privilege('service_role','public.start_course_renewal(uuid,uuid,text,jsonb,jsonb,jsonb)','EXECUTE'),
    'service_role starts renewals');

SET LOCAL ROLE service_role;

SELECT public.test_assert(public.test_try_save(200,'CASH',5) LIKE '23514:Există deja o înscriere%',
    'before #695 a cash purchase on an active enrollment is refused');
SELECT public.test_assert(public.test_try_save(200,'CARD',5) LIKE '23514:Înscrierea este deja procesată%',
    'before #695 a card purchase on an active enrollment is refused');

SELECT public.test_assert(public.test_try_renew(2,500,'CASH',public.test_quote(200,5)) = '42501:RENEWAL_REFUSED', 'another parent is refused');
SELECT public.test_assert(public.test_try_renew(3,500,'CASH',public.test_quote(200,5)) = '42501:RENEWAL_REFUSED', 'a coach is refused');
SELECT public.test_assert(public.test_try_renew(1,501,'CASH',public.test_quote(201,5)) = '23514:RENEWAL_REFUSED', 'a pending enrollment is refused');
SELECT public.test_assert(public.test_try_renew(1,999,'CASH',public.test_quote(200,5)) = 'P0002:RENEWAL_REFUSED', 'an unknown enrollment is refused');
SELECT public.test_assert(public.test_try_renew(1,500,'CASH',public.test_quote(201,5)) = '23514:RENEWAL_REFUSED', 'a snapshot for another child is refused');
SELECT public.test_assert(public.test_try_renew(1,500,'CASH',public.test_quote(200,5,101)) = '23514:RENEWAL_REFUSED', 'a snapshot for another course is refused');
SELECT public.test_assert(public.test_try_renew(1,500,'CASH',public.test_quote(200,5,100,900)) = '23514:PRICE_CHANGED',
    'a stale price is refused');
SELECT public.test_assert(public.test_try_renew(1,500,'CASH',public.test_quote(200,5,100,0)) = '23514:RENEWAL_REFUSED', 'a free renewal is refused');
SELECT public.test_assert(public.test_try_renew(1,500,'CASH',public.test_quote(200,5) || '{"amount":4000}') = '23514:RENEWAL_REFUSED',
    'an amount that does not match the snapshot is refused');
SELECT public.test_assert(public.test_try_renew(1,500,'BANK',public.test_quote(200,5)) = '22023:RENEWAL_REFUSED', 'an unknown method is refused');

DO $$
DECLARE v_state TEXT;
BEGIN
    BEGIN
        PERFORM public.start_course_renewal(public.test_uuid(1), public.test_uuid(500), 'CARD', public.test_quote(200,5), NULL,
            public.test_acceptance());
        v_state := 'OK';
    EXCEPTION WHEN OTHERS THEN v_state := SQLSTATE;
    END;
    PERFORM public.test_assert(v_state = '22023', 'a card renewal without billing details is refused');
END;
$$;

UPDATE public.courses SET active = false WHERE id = public.test_uuid(100);
SELECT public.test_assert(public.test_try_renew(1,500,'CASH',public.test_quote(200,5)) = '23514:RENEWAL_REFUSED', 'an inactive course is refused');
UPDATE public.courses SET active = true WHERE id = public.test_uuid(100);
INSERT INTO public.test_inactive_offers VALUES(public.test_uuid(100));
SELECT public.test_assert(public.test_try_renew(1,500,'CASH',public.test_quote(200,5)) = '23514:SUBSCRIPTION_INACTIVE',
    'an offer without platform access is refused');
DELETE FROM public.test_inactive_offers;
SELECT public.test_assert((SELECT count(*) FROM public.payments WHERE enrollment_id = public.test_uuid(500)) = 1,
    'refused renewals write no payment');

DO $$
DECLARE v_result JSONB; v_old UUID;
BEGIN
    v_result := public.test_renew(1,500,'CASH',public.test_quote(200,5));
    PERFORM public.test_assert(v_result->>'enrollmentId' = public.test_uuid(500)::TEXT, 'renewal returns the same enrollment');
    PERFORM public.test_assert((v_result->>'sessions')::INTEGER = 5 AND (v_result->>'reused')::BOOLEAN = false,
        'renewal reports the new package');
    PERFORM public.test_assert((v_result->>'requiresPaymentIntent')::BOOLEAN = false, 'cash needs no card payment');
    PERFORM public.test_assert(EXISTS (SELECT 1 FROM public.payments WHERE id = (v_result->>'paymentId')::UUID
        AND method = 'CASH' AND status = 'PENDING' AND amount = 5000 AND billing_name IS NULL
        AND pricing_snapshot = public.test_quote(200,5)->'snapshot'), 'cash renewal is a new pending payment');
    PERFORM public.test_assert((SELECT status FROM public.enrollments WHERE id = public.test_uuid(500)) = 'ACTIVE',
        'the enrollment stays active while the renewal waits');
    PERFORM public.test_assert((SELECT count(*) FROM public.checkout_acceptances
        WHERE enrollment_ids = ARRAY[public.test_uuid(500)] AND payment_method = 'CASH') = 1, 'acceptance is recorded');

    PERFORM public.test_assert(public.test_renew(1,500,'CASH',public.test_quote(200,5))->>'paymentId' = v_result->>'paymentId',
        'repeating the same renewal reuses the open payment');
    PERFORM public.test_assert((SELECT count(*) FROM public.payments WHERE enrollment_id = public.test_uuid(500)) = 2,
        'no duplicate payment');

    v_old := (v_result->>'paymentId')::UUID;
    v_result := public.test_renew(1,500,'CASH',public.test_quote(200,4));
    PERFORM public.test_assert((v_result->>'replaced')::BOOLEAN AND (v_result->>'paymentId')::UUID <> v_old,
        'another package replaces the unpaid cash renewal');
    PERFORM public.test_assert(NOT EXISTS (SELECT 1 FROM public.payments WHERE id = v_old)
        AND (SELECT count(*) FROM public.payments WHERE enrollment_id = public.test_uuid(500)) = 2
        AND (SELECT remaining_sessions FROM public.enrollments WHERE id = public.test_uuid(500)) = 0,
        'the replaced payment is gone and no session was added');
    v_result := public.test_renew(1,500,'CARD',public.test_quote(200,5));
    PERFORM public.test_assert((v_result->>'replaced')::BOOLEAN, 'switching an unstarted renewal to card replaces it');
    PERFORM public.test_assert(EXISTS (SELECT 1 FROM public.payments WHERE id = (v_result->>'paymentId')::UUID
        AND method = 'CARD' AND amount = 5000 AND billing_name = 'Ana Părinte' AND billing_country = 'RO'
        AND pricing_snapshot = public.test_quote(200,5)->'snapshot'), 'the open payment now waits for the card');
    PERFORM public.test_assert(public.test_try_renew(1,500,'CASH',public.test_quote(200,101)) = '22023:RENEWAL_REFUSED',
        'more than 100 sessions at once is refused');

    INSERT INTO public.payment_intent_requests(id) VALUES ((v_result->>'paymentId')::UUID);
    PERFORM public.test_assert(public.test_try_renew(1,500,'CASH',public.test_quote(200,5)) = '23514:RENEWAL_IN_PROGRESS',
        'a card payment with a prepared Stripe intent cannot be replaced');
    DELETE FROM public.payment_intent_requests;

    UPDATE public.payments SET gateway_txn_id = 'cs_test_renewal' WHERE id = (v_result->>'paymentId')::UUID;
    PERFORM public.test_assert(public.test_try_renew(1,500,'CASH',public.test_quote(200,5)) = '23514:RENEWAL_IN_PROGRESS',
        'a started card payment cannot be changed');
    PERFORM public.test_assert(public.test_renew(1,500,'CARD',public.test_quote(200,5))->>'paymentId' = v_result->>'paymentId',
        'the same card renewal can be resumed');
    PERFORM public.test_assert(EXISTS (SELECT 1 FROM public.payments WHERE id = (v_result->>'paymentId')::UUID
        AND gateway_txn_id = 'cs_test_renewal' AND amount = 5000), 'resuming keeps the started Stripe attempt');

    BEGIN
        INSERT INTO public.payments(enrollment_id,method,amount,currency,status) VALUES(public.test_uuid(500),'CASH',1000,'RON','PENDING');
        RAISE EXCEPTION 'a second open payment was accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    PERFORM public.apply_enrollment_payment_result((v_result->>'paymentId')::UUID, 'SUCCEEDED', 5000, 'RON', 'CARD', 'cs_test_renewal');
    PERFORM public.test_assert((SELECT purchased_sessions = 8 AND remaining_sessions = 5 AND sessions_used = 3 AND status = 'ACTIVE'
        FROM public.enrollments WHERE id = public.test_uuid(500)), 'a confirmed card renewal adds its sessions');
    PERFORM public.test_assert((SELECT status FROM public.payments WHERE id = public.test_uuid(600)) = 'SUCCEEDED',
        'the first payment is untouched');
END;
$$;

DO $$
DECLARE v_result JSONB;
BEGIN
    v_result := public.test_renew(1,500,'CASH',public.test_quote(200,2));
    PERFORM public.test_assert((v_result->>'reused')::BOOLEAN = false, 'after a confirmed renewal the next one is new');
    PERFORM public.apply_enrollment_payment_result((v_result->>'paymentId')::UUID, 'SUCCEEDED', 2000, 'RON', 'CASH', NULL);
    PERFORM public.test_assert((SELECT purchased_sessions = 10 AND remaining_sessions = 7
        FROM public.enrollments WHERE id = public.test_uuid(500)), 'a confirmed cash renewal adds its sessions');
    PERFORM public.test_assert((SELECT count(*) FROM public.payments WHERE enrollment_id = public.test_uuid(500)) = 3,
        'three purchases on the same enrollment');

    v_result := public.test_renew(1,500,'CARD',public.test_quote(200,3));
    UPDATE public.payments SET gateway_txn_id = 'pi_failed' WHERE id = (v_result->>'paymentId')::UUID;
    PERFORM public.apply_enrollment_payment_result((v_result->>'paymentId')::UUID, 'FAILED', 3000, 'RON', 'CARD', 'pi_failed');
    PERFORM public.test_assert((SELECT remaining_sessions = 7 AND status = 'ACTIVE' FROM public.enrollments
        WHERE id = public.test_uuid(500)), 'a failed card renewal adds nothing and keeps the enrollment active');
    PERFORM public.test_assert(public.test_try_renew(1,500,'CASH',public.test_quote(200,3)) = '23514:RENEWAL_IN_PROGRESS',
        'a failed Stripe attempt must be resumed, not replaced');
END;
$$;

RESET ROLE;
ROLLBACK;
\echo 'course-session-renewal: all assertions passed'
