\set ON_ERROR_STOP on
BEGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE public.courses (id UUID PRIMARY KEY, currency TEXT NOT NULL, price_per_session BIGINT NOT NULL);
CREATE TABLE public.activities (id UUID PRIMARY KEY, currency TEXT NOT NULL, price BIGINT NOT NULL);
CREATE TABLE public.camps (id UUID PRIMARY KEY, currency TEXT NOT NULL, price BIGINT NOT NULL);
CREATE TABLE public.children (id UUID PRIMARY KEY, parent_id UUID NOT NULL);
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY, kind TEXT NOT NULL, entity_id UUID NOT NULL, child_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', purchased_sessions INTEGER NOT NULL DEFAULT 0,
    remaining_sessions INTEGER NOT NULL DEFAULT 0, sessions_used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE public.payments (
    id UUID PRIMARY KEY, enrollment_id UUID NOT NULL REFERENCES public.enrollments(id),
    method TEXT NOT NULL, amount BIGINT NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING',
    gateway_txn_id TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), paid_at TIMESTAMPTZ
);
GRANT ALL ON public.courses, public.activities, public.camps, public.children, public.enrollments, public.payments TO service_role;
\i /tmp/migrations/00048_enrollment_price_snapshots.sql
\i /tmp/migrations/00050_atomic_enrollment_payment_completion.sql
\i /tmp/migrations/00051_safe_legacy_draft_cancellation.sql
\i /tmp/migrations/00053_frozen_stripe_intent_requests.sql
CREATE FUNCTION public.test_uuid(v INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-0000-0000-' || lpad(v::TEXT, 12, '0'))::UUID
$$;
CREATE FUNCTION public.test_assert(ok BOOLEAN, label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION '%', label; END IF; END;
$$;
CREATE FUNCTION public.test_complete(v INTEGER, outcome TEXT DEFAULT 'SUCCEEDED') RETURNS JSONB
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
    SELECT public.apply_enrollment_payment_result(public.test_uuid(v), outcome, 50000, 'RON',
        CASE WHEN v = 1 THEN 'CASH' ELSE 'CARD' END,
        CASE WHEN v = 1 THEN NULL ELSE 'pi_' || v END)
$$;
INSERT INTO public.courses VALUES (public.test_uuid(100), 'EUR', 99999, 6000000);
INSERT INTO public.children VALUES (public.test_uuid(200), public.test_uuid(300));
INSERT INTO public.enrollments(id, kind, entity_id, child_id)
SELECT public.test_uuid(v + 1000), 'COURSE', public.test_uuid(100), public.test_uuid(200) FROM generate_series(1,5) v;
INSERT INTO public.payments(id,enrollment_id,method,amount,currency,gateway_txn_id,pricing_snapshot)
SELECT public.test_uuid(v),public.test_uuid(v + 1000),CASE WHEN v=1 THEN 'CASH' ELSE 'CARD' END,50000,'RON',
    CASE WHEN v=1 THEN NULL ELSE 'pi_' || v END,
    jsonb_build_object('schemaVersion',1,'kind','COURSE','entityId',public.test_uuid(100),'childId',public.test_uuid(200),
        'sourceUnitAmount',1000,'sourceCurrency','EUR','quantity',10,'eurRonRateMicros',5000000,
        'amount',50000,'currency','RON','priceVersion',repeat('a',64))
FROM generate_series(1,5) v;
INSERT INTO public.enrollments(id,kind,entity_id,child_id) VALUES
    (public.test_uuid(1090),'COURSE',public.test_uuid(100),public.test_uuid(200));
INSERT INTO public.payments(id,enrollment_id,method,amount,currency) VALUES
    (public.test_uuid(90),public.test_uuid(1090),'CARD',50000,'RON');
SELECT public.test_assert(NOT has_table_privilege('authenticated','public.payment_intent_requests','SELECT'), 'parents cannot read Stripe request data');
SELECT public.test_assert(NOT has_table_privilege('authenticated','public.payment_intent_requests','INSERT'), 'parents cannot freeze Stripe requests');
SELECT public.test_assert(NOT has_function_privilege('authenticated','public.freeze_payment_intent_request(uuid,jsonb)','EXECUTE'), 'request RPC is backend only');
SET LOCAL ROLE service_role;
DO $$
DECLARE original JSONB; changed JSONB;
BEGIN
    original := jsonb_build_object('amount',50000,'currency','ron','metadata',
        jsonb_build_object('paymentId',public.test_uuid(90),'enrollmentId',public.test_uuid(1090)),
        'receipt_email','original@example.test','application_fee_amount',1000,
        'transfer_data',jsonb_build_object('destination','acct_original'));
    BEGIN
        PERFORM public.freeze_payment_intent_request(public.test_uuid(90),original || '{"amount":1}'::JSONB);
        RAISE EXCEPTION 'Wrong amount accepted' USING ERRCODE='XX000';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    PERFORM public.test_assert(public.freeze_payment_intent_request(public.test_uuid(90),original)=original,'first request frozen');
    changed := original || '{"receipt_email":"changed@example.test","transfer_data":{"destination":"acct_changed"},"application_fee_amount":2000}'::JSONB;
    PERFORM public.test_assert(public.freeze_payment_intent_request(public.test_uuid(90),changed)=original,'retry keeps original routing email and fees');
END;
$$;
RESET ROLE;
UPDATE public.payment_intent_requests SET created_at=now()-interval '24 hours' WHERE id=public.test_uuid(90);
SET LOCAL ROLE service_role;
DO $$
BEGIN
    BEGIN
        PERFORM public.freeze_payment_intent_request(public.test_uuid(90),'{}'::JSONB);
        RAISE EXCEPTION 'Expired idempotency window accepted' USING ERRCODE='XX000';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END;
$$;
RESET ROLE;
SELECT public.test_assert(NOT has_function_privilege('authenticated',
    'public.apply_enrollment_payment_result(uuid,text,bigint,text,text,text)', 'EXECUTE'), 'authenticated cannot settle payments');
SELECT public.test_assert(NOT has_function_privilege('anon',
    'public.apply_enrollment_payment_result(uuid,text,bigint,text,text,text)', 'EXECUTE'), 'anonymous cannot settle payments');
SET LOCAL ROLE service_role;
SELECT public.test_assert(public.test_complete(1)->>'sessionsAdded' = '10', 'cash credits accepted quantity despite changed course price/rate');
SELECT public.test_assert(public.test_complete(1)->>'changed' = 'false', 'repeated cash confirmation is idempotent');
SELECT public.test_assert((SELECT remaining_sessions=10 AND purchased_sessions=10 FROM public.enrollments WHERE id=public.test_uuid(1001)), 'cash credited once');
SELECT public.test_assert(public.test_complete(2,'FAILED')->>'status' = 'FAILED', 'failure recorded');
SELECT public.test_assert((SELECT status='PENDING' AND remaining_sessions=0 FROM public.enrollments WHERE id=public.test_uuid(1002)), 'failure preserves enrollment for retry');
SELECT public.test_assert(public.test_complete(2)->>'sessionsAdded' = '10', 'card retry credits accepted quantity');
SELECT public.test_assert(public.test_complete(2,'FAILED')->>'changed' = 'false', 'late failure cannot reverse paid enrollment');
SELECT public.test_assert((SELECT status='ACTIVE' AND remaining_sessions=10 FROM public.enrollments WHERE id=public.test_uuid(1002)), 'late failure preserves sessions');
DO $$
DECLARE scenario RECORD;
BEGIN
    FOR scenario IN SELECT * FROM (VALUES
        (49999::BIGINT,'RON','CARD','pi_3'),
        (50000,'EUR','CARD','pi_3'),
        (50000,'RON','CARD','pi_wrong'),
        (50000,'RON','CASH',NULL)
    ) x(amount,currency,method,gateway)
    LOOP
        BEGIN
            PERFORM public.apply_enrollment_payment_result(public.test_uuid(3),'SUCCEEDED',scenario.amount,scenario.currency,scenario.method,scenario.gateway);
            RAISE EXCEPTION 'Mismatched charge accepted' USING ERRCODE='XX000';
        EXCEPTION WHEN check_violation THEN NULL;
        END;
    END LOOP;
END;
$$;
SELECT public.test_assert((SELECT status='PENDING' AND paid_at IS NULL FROM public.payments WHERE id=public.test_uuid(3)), 'mismatches preserve payment');
UPDATE public.enrollments SET remaining_sessions=2147483640, purchased_sessions=2147483640 WHERE id=public.test_uuid(1004);
DO $$
BEGIN
    BEGIN
        PERFORM public.test_complete(4);
        RAISE EXCEPTION 'Overflow should fail' USING ERRCODE='XX000';
    EXCEPTION WHEN numeric_value_out_of_range THEN NULL;
    END;
END;
$$;
SELECT public.test_assert((SELECT status='PENDING' AND paid_at IS NULL FROM public.payments WHERE id=public.test_uuid(4)), 'failed session credit cannot mark payment paid');
SELECT public.test_assert((SELECT remaining_sessions=2147483640 FROM public.enrollments WHERE id=public.test_uuid(1004)), 'failed credit preserves balance');
SELECT public.test_assert(public.cancel_unaccepted_enrollment_draft(public.test_uuid(1003),public.test_uuid(301))->>'reason'='not_owner', 'foreign parent cannot cancel');
SELECT public.test_assert(public.cancel_unaccepted_enrollment_draft(public.test_uuid(1003),public.test_uuid(300))->>'reason'='payment_retained_for_retry', 'accepted offer and gateway survive old-client cancellation');
SELECT public.test_assert(public.cancel_unaccepted_enrollment_draft(public.test_uuid(1001),public.test_uuid(300))->>'reason'='status_ACTIVE', 'paid enrollment cannot be cancelled');
INSERT INTO public.enrollments(id,kind,entity_id,child_id) VALUES (public.test_uuid(1006),'COURSE',public.test_uuid(100),public.test_uuid(200));
INSERT INTO public.payments(id,enrollment_id,method,amount,currency,gateway_txn_id) VALUES (public.test_uuid(6),public.test_uuid(1006),'CARD',50000,'RON','pi_legacy');
SELECT public.test_assert(public.cancel_unaccepted_enrollment_draft(public.test_uuid(1006),public.test_uuid(300))->>'reason'='payment_retained_for_retry', 'legacy gateway cannot be deleted without proof');
UPDATE public.payments SET gateway_txn_id=NULL WHERE id=public.test_uuid(6);
SELECT public.test_assert(public.cancel_unaccepted_enrollment_draft(public.test_uuid(1006),public.test_uuid(300))->>'cancelled'='true', 'unaccepted uncharged draft can be cancelled');
SELECT public.test_assert(NOT EXISTS(SELECT FROM public.payments WHERE id=public.test_uuid(6)) AND NOT EXISTS(SELECT FROM public.enrollments WHERE id=public.test_uuid(1006)), 'draft and payment removed together');
SELECT public.test_assert(NOT has_function_privilege('authenticated','public.cancel_unaccepted_enrollment_draft(uuid,uuid)','EXECUTE'), 'parent identity cannot be forged through public RPC');
RESET ROLE;
COMMIT;
\echo 'Payment completion: snapshot quantity, replay, stale events, mismatches and rollback verified'
