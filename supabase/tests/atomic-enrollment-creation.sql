\set ON_ERROR_STOP on
BEGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE public.profiles(id UUID PRIMARY KEY, role TEXT NOT NULL);
CREATE TABLE public.children(id UUID PRIMARY KEY, parent_id UUID NOT NULL REFERENCES public.profiles(id), birth_date DATE NOT NULL);
CREATE TABLE public.courses(id UUID PRIMARY KEY, currency TEXT NOT NULL, price_per_session BIGINT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true, capacity INTEGER, age_from INTEGER, age_to INTEGER);
CREATE TABLE public.activities(id UUID PRIMARY KEY, currency TEXT NOT NULL, price BIGINT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true, capacity INTEGER);
CREATE TABLE public.camps(id UUID PRIMARY KEY, currency TEXT NOT NULL, price BIGINT NOT NULL,
    capacity INTEGER, allow_cash BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE public.enrollments(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), kind TEXT NOT NULL,
    entity_id UUID NOT NULL, child_id UUID NOT NULL REFERENCES public.children(id), status TEXT NOT NULL DEFAULT 'PENDING',
    purchased_sessions INTEGER NOT NULL DEFAULT 0, remaining_sessions INTEGER NOT NULL DEFAULT 0,
    sessions_used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE public.payments(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), enrollment_id UUID NOT NULL REFERENCES public.enrollments(id),
    method TEXT NOT NULL, amount BIGINT NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING',
    gateway_txn_id TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), paid_at TIMESTAMPTZ,
    billing_name TEXT, billing_email TEXT, billing_address_line1 TEXT, billing_city TEXT, billing_postal_code TEXT, billing_country TEXT);
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
\i /tmp/migrations/00060_atomic_enrollment_creation.sql
\i /tmp/migrations/00061_free_enrollment_fulfillment.sql
CREATE FUNCTION public.test_uuid(v INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-0000-0000-' || lpad(v::TEXT,12,'0'))::UUID
$$;
CREATE FUNCTION public.test_assert(ok BOOLEAN,label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',label; END IF; END;
$$;
CREATE FUNCTION public.test_quote(v_child INTEGER,v_kind TEXT DEFAULT 'COURSE',v_entity INTEGER DEFAULT 100,
    v_unit BIGINT DEFAULT 1000,v_currency TEXT DEFAULT 'EUR',v_rate BIGINT DEFAULT 5123456,v_quantity INTEGER DEFAULT 3)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT jsonb_build_object('childId',public.test_uuid(v_child),'amount',amount,'currency','RON','priceVersion',repeat('a',64),
        'snapshot',jsonb_build_object('schemaVersion',1,'kind',v_kind,'entityId',public.test_uuid(v_entity),
            'childId',public.test_uuid(v_child),'sourceUnitAmount',v_unit,'sourceCurrency',v_currency,'quantity',v_quantity,
            'eurRonRateMicros',v_rate,'amount',amount,'currency','RON','priceVersion',repeat('a',64)))
    FROM (SELECT CASE WHEN v_currency='RON' THEN v_unit::NUMERIC*v_quantity
        ELSE floor((v_unit::NUMERIC*v_quantity*v_rate+500000)/1000000) END AS amount) v
$$;
CREATE FUNCTION public.test_save(v_children INTEGER[],v_method TEXT DEFAULT 'CARD',v_entity INTEGER DEFAULT 100)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER AS $$
    SELECT public.save_enrollment_batch(public.test_uuid(1),'COURSE',public.test_uuid(v_entity),v_method,
        (SELECT jsonb_agg(public.test_quote(v,'COURSE',v_entity)) FROM unnest(v_children) v))
$$;
CREATE FUNCTION public.test_try_save(v_children INTEGER[],v_method TEXT DEFAULT 'CARD',v_entity INTEGER DEFAULT 100)
RETURNS TEXT LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
    PERFORM public.test_save(v_children,v_method,v_entity);
    RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE;
END;
$$;
CREATE FUNCTION public.test_fail_payment() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.pricing_snapshot->>'childId'=public.test_uuid(299)::TEXT THEN
        RAISE EXCEPTION 'Test payment insert failure' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER test_payment_failure BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.test_fail_payment();
INSERT INTO public.profiles VALUES(public.test_uuid(1),'PARENT'),(public.test_uuid(2),'PARENT'),(public.test_uuid(3),'COACH');
INSERT INTO public.children SELECT public.test_uuid(v),public.test_uuid(CASE WHEN v=298 THEN 2 ELSE 1 END),'2018-01-01'::DATE
    FROM generate_series(200,299) v;
INSERT INTO public.courses(id,currency,price_per_session,eur_ron_rate_micros,capacity)
    VALUES(public.test_uuid(100),'EUR',1000,5123456,NULL),(public.test_uuid(101),'EUR',1000,5123456,1),
        (public.test_uuid(102),'EUR',1000,5123456,NULL),(public.test_uuid(103),'EUR',1000,5123456,1);
INSERT INTO public.activities(id,currency,price) VALUES(public.test_uuid(110),'RON',2500);
INSERT INTO public.camps(id,currency,price,allow_cash) VALUES(public.test_uuid(120),'RON',8000,true);
SELECT public.test_assert(NOT has_function_privilege('anon','public.save_enrollment_batch(uuid,text,uuid,text,jsonb,jsonb)','EXECUTE'),'anonymous cannot accept pricing');
SELECT public.test_assert(NOT has_function_privilege('authenticated','public.save_enrollment_batch(uuid,text,uuid,text,jsonb,jsonb)','EXECUTE'),'clients cannot forge parent or quotes');
SELECT public.test_assert(has_function_privilege('service_role','public.save_enrollment_batch(uuid,text,uuid,text,jsonb,jsonb)','EXECUTE'),'backend can save batch');
SET LOCAL ROLE service_role;
SELECT public.test_assert(public.test_try_save(ARRAY[200,201])='OK','initial multi-child creation succeeds');
SELECT public.test_assert((SELECT count(*)=2 FROM public.enrollments) AND (SELECT count(*)=2 FROM public.payments),'one payment per child created');
SELECT public.test_assert((SELECT bool_and(amount=15370 AND currency='RON') FROM public.payments),'source EUR converted once to accepted RON');
SELECT public.test_assert(public.test_try_save(ARRAY[200,201])='OK','identical retry reuses pending rows');
SELECT public.test_assert((SELECT count(*)=2 FROM public.enrollments) AND (SELECT count(*)=2 FROM public.payments),'retry has no duplicate writes');
UPDATE public.courses SET price_per_session=9999,eur_ron_rate_micros=6000000 WHERE id=public.test_uuid(100);
SELECT public.test_assert(public.test_try_save(ARRAY[200,201])='OK','pending snapshots survive source changes');
SELECT public.test_assert(public.test_try_save(ARRAY[202])='23514','new unaccepted stale quote rejects');
SELECT public.test_assert(NOT EXISTS(SELECT FROM public.enrollments WHERE child_id=public.test_uuid(202)),'changed source creates nothing');
UPDATE public.courses SET price_per_session=1000,eur_ron_rate_micros=5123456 WHERE id=public.test_uuid(100);
SELECT public.test_assert(public.test_try_save(ARRAY[203,298])='42501','foreign second child rejects');
SELECT public.test_assert(NOT EXISTS(SELECT FROM public.enrollments WHERE child_id=public.test_uuid(203)),'foreign second child rolls back first enrollment and payment');
SELECT public.test_assert(public.test_try_save(ARRAY[204,299])='23514','second child payment insert failure rejects batch');
SELECT public.test_assert(NOT EXISTS(SELECT FROM public.enrollments WHERE child_id IN (public.test_uuid(204),public.test_uuid(299))),'second payment failure leaves neither enrollment');
SELECT public.test_assert((SELECT count(*)=2 FROM public.payments),'payment failure does not leave an orphan payment');
SELECT public.test_assert(public.test_try_save(ARRAY[205,205])='22023','duplicate child selection rejects');
SELECT public.test_assert(public.test_try_save(ARRAY[206,207],'CARD',103)='23514','capacity applies to complete batch');
SELECT public.test_assert(NOT EXISTS(SELECT FROM public.enrollments WHERE entity_id=public.test_uuid(103)),'capacity failure rolls back first seat');
SELECT public.test_assert(public.test_try_save(ARRAY[208],'CASH')='OK','cash enrollment still creates pending payment');
SELECT public.test_assert(public.test_try_save(ARRAY[208],'CASH')='23514','cash repeat cannot duplicate');
SELECT public.test_assert(public.test_try_save(ARRAY[208],'CARD')='OK','unpaid cash may move to card with same accepted snapshot');
SELECT public.test_assert((SELECT count(*)=1 FROM public.payments p JOIN public.enrollments e ON e.id=p.enrollment_id
    WHERE e.child_id=public.test_uuid(208) AND p.method='CARD' AND p.amount=15370),'cash switch keeps single accepted payment');
DO $$
DECLARE ids JSONB; payment UUID; outcome JSONB;
BEGIN
    ids := public.test_save(ARRAY[200,201]);
    SELECT p.id INTO payment FROM public.payments p JOIN public.enrollments e ON e.id=p.enrollment_id WHERE e.child_id=public.test_uuid(200);
    UPDATE public.payments SET gateway_txn_id='pi_200' WHERE id=payment;
    outcome := public.apply_enrollment_payment_result(payment,'SUCCEEDED',15370,'RON','CARD','pi_200');
    PERFORM public.test_assert(outcome->>'sessionsAdded'='3','first completion credits accepted quantity');
    PERFORM public.test_assert(public.test_save(ARRAY[200,201])=ids,'partially paid batch reuses exactly same ids');
    PERFORM public.test_assert(public.apply_enrollment_payment_result(payment,'SUCCEEDED',15370,'RON','CARD','pi_200')->>'changed'='false','completion replay changes nothing');
    PERFORM public.test_assert(public.apply_enrollment_payment_result(payment,'FAILED',15370,'RON','CARD','pi_200')->>'changed'='false','late failed event cannot undo success');
    PERFORM public.test_assert((SELECT purchased_sessions=3 AND remaining_sessions=3 FROM public.enrollments WHERE child_id=public.test_uuid(200)),'paid retry never credits twice');
    BEGIN
        PERFORM public.save_enrollment_batch(public.test_uuid(1),'COURSE',public.test_uuid(100),'CARD',
            jsonb_build_array(jsonb_set(public.test_quote(200),'{snapshot,priceVersion}',to_jsonb(repeat('b',64)))));
        RAISE EXCEPTION 'Mismatched active snapshot accepted' USING ERRCODE='XX000';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END;
$$;
DO $$
DECLARE result JSONB; quote JSONB;
BEGIN
    result := public.save_enrollment_batch(public.test_uuid(1),'ACTIVITY',public.test_uuid(110),'CARD',
        jsonb_build_array(public.test_quote(210,'ACTIVITY',110,2500,'RON',NULL,1)));
    PERFORM public.test_assert(result->'prices'->0->>'amount'='2500','activity RON contract preserved');
    result := public.save_enrollment_batch(public.test_uuid(1),'CAMP',public.test_uuid(120),'CASH',
        jsonb_build_array(public.test_quote(211,'CAMP',120,8000,'RON',NULL,1)));
    PERFORM public.test_assert(result->>'requiresPaymentIntent'='false','camp cash contract preserved');
    UPDATE public.camps SET allow_cash=false WHERE id=public.test_uuid(120);
    BEGIN
        PERFORM public.save_enrollment_batch(public.test_uuid(1),'CAMP',public.test_uuid(120),'CASH',
            jsonb_build_array(public.test_quote(212,'CAMP',120,8000,'RON',NULL,1)));
        RAISE EXCEPTION 'Cash-disabled camp accepted' USING ERRCODE='XX000';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        PERFORM public.save_enrollment_batch(public.test_uuid(3),'COURSE',public.test_uuid(100),'CARD',jsonb_build_array(public.test_quote(213)));
        RAISE EXCEPTION 'Coach accepted as parent' USING ERRCODE='XX000';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        PERFORM public.save_enrollment_batch(public.test_uuid(1),'COURSE',public.test_uuid(100),'CARD',
            jsonb_build_array(public.test_quote(213)||'{"snapshot":null}'::JSONB));
        RAISE EXCEPTION 'Unaccepted new payment created' USING ERRCODE='XX000';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END;
$$;
INSERT INTO public.enrollments(id,kind,entity_id,child_id) VALUES(public.test_uuid(400),'COURSE',public.test_uuid(100),public.test_uuid(214));
INSERT INTO public.payments(enrollment_id,method,amount,currency,gateway_txn_id)
    VALUES(public.test_uuid(400),'CARD',7000,'RON','pi_legacy');
SELECT public.test_assert(public.save_enrollment_batch(public.test_uuid(1),'COURSE',public.test_uuid(100),'CARD',
    '[{"childId":"00000000-0000-0000-0000-000000000214","amount":7000,"currency":"RON","snapshot":null,"priceVersion":"legacy"}]'::JSONB)->'prices'->0->>'amount'='7000','legacy bound gateway preserves amount without inventing snapshot');
INSERT INTO public.enrollments(kind,entity_id,child_id) SELECT 'COURSE',public.test_uuid(100),public.test_uuid(215) FROM generate_series(1,2);
SELECT public.test_assert(public.test_try_save(ARRAY[215])='23514','ambiguous enrollments reject without cleanup');
SELECT public.test_assert((SELECT count(*)=2 FROM public.enrollments WHERE child_id=public.test_uuid(215)),'legacy duplicates preserved for review');
INSERT INTO public.camps(id,currency,price,allow_cash) VALUES(public.test_uuid(121),'RON',0,false),(public.test_uuid(123),'RON',8000,false);
RESET ROLE;
CREATE OR REPLACE FUNCTION public.enrollment_camp_offer(p_camp_id UUID,p_child_id UUID) RETURNS JSONB
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
    SELECT jsonb_build_object('amount', CASE WHEN p_child_id = public.test_uuid(217) THEN 0 ELSE price END,
        'currency',currency,'eur_ron_rate_micros',eur_ron_rate_micros)
    FROM public.camps WHERE id=p_camp_id
$$;
SET LOCAL ROLE service_role;
DO $$
DECLARE result JSONB; first JSONB;
BEGIN
    result := public.save_enrollment_batch(public.test_uuid(1),'CAMP',public.test_uuid(121),'CARD',
        jsonb_build_array(public.test_quote(216,'CAMP',121,0,'RON',NULL,1)));
    PERFORM public.test_assert(result->>'requiresPaymentIntent'='false','free camp does not require a card intent');
    PERFORM public.test_assert((SELECT e.status='ACTIVE' FROM public.enrollments e WHERE e.child_id=public.test_uuid(216)),'free camp enrollment is active');
    PERFORM public.test_assert((SELECT p.status='SUCCEEDED' AND p.amount=0 AND p.gateway_txn_id IS NULL FROM public.payments p
        JOIN public.enrollments e ON e.id=p.enrollment_id WHERE e.child_id=public.test_uuid(216)),'free camp payment is fulfilled at zero');
    first := result;
    result := public.save_enrollment_batch(public.test_uuid(1),'CAMP',public.test_uuid(121),'CARD',
        jsonb_build_array(public.test_quote(216,'CAMP',121,0,'RON',NULL,1)));
    PERFORM public.test_assert(result->'enrollmentIds' = first->'enrollmentIds','free camp retry reuses the fulfilled enrollment');
    result := public.save_enrollment_batch(public.test_uuid(1),'CAMP',public.test_uuid(123),'CARD',
        jsonb_build_array(public.test_quote(217,'CAMP',123,0,'RON',NULL,1), public.test_quote(218,'CAMP',123,8000,'RON',NULL,1)));
    PERFORM public.test_assert(result->>'requiresPaymentIntent'='true','mixed batch still needs a card intent');
    PERFORM public.test_assert((SELECT e.status='ACTIVE' FROM public.enrollments e WHERE e.child_id=public.test_uuid(217)),'free sibling is active immediately');
    PERFORM public.test_assert((SELECT e.status='PENDING' FROM public.enrollments e WHERE e.child_id=public.test_uuid(218)),'paid sibling waits for card');
END;
$$;
RESET ROLE;
COMMIT;
\echo 'Atomic enrollment creation: ownership, accepted prices, rollback, capacity, replay and fulfillment passed'
