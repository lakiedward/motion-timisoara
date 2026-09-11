\set ON_ERROR_STOP on
BEGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE public.courses (id UUID PRIMARY KEY, currency TEXT NOT NULL, price_per_session BIGINT NOT NULL);
CREATE TABLE public.activities (id UUID PRIMARY KEY, currency TEXT NOT NULL, price BIGINT NOT NULL);
CREATE TABLE public.camps (id UUID PRIMARY KEY, currency TEXT NOT NULL, price BIGINT NOT NULL);
CREATE TABLE public.enrollments (id UUID PRIMARY KEY, kind TEXT NOT NULL, entity_id UUID NOT NULL, child_id UUID NOT NULL);
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), enrollment_id UUID NOT NULL REFERENCES public.enrollments(id),
    amount BIGINT NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL, gateway_txn_id TEXT
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.courses, public.activities, public.camps, public.enrollments, public.payments TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT SELECT ON public.enrollments TO authenticated;
CREATE POLICY admin_fixture ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.courses VALUES ('00000000-0000-0000-0000-000000000001','RON',1500);
INSERT INTO public.activities VALUES ('00000000-0000-0000-0000-000000000001','RON',1500);
INSERT INTO public.camps VALUES ('00000000-0000-0000-0000-000000000001','EUR',1500);
INSERT INTO public.enrollments VALUES
    ('00000000-0000-0000-0000-000000000010','COURSE','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
INSERT INTO public.payments (enrollment_id,amount,currency,status,gateway_txn_id) VALUES
    ('00000000-0000-0000-0000-000000000010',12345,'EUR','SUCCEEDED','pi_historical');

\i /tmp/migration.sql

CREATE FUNCTION pg_temp.snapshot(p_currency TEXT DEFAULT 'EUR', p_rate BIGINT DEFAULT 5123456, p_unit BIGINT DEFAULT 10000, p_quantity BIGINT DEFAULT 1, p_amount BIGINT DEFAULT 51235)
RETURNS JSONB LANGUAGE sql AS $$
SELECT jsonb_build_object('schemaVersion',1,'kind','COURSE',
    'entityId','00000000-0000-0000-0000-000000000001','childId','00000000-0000-0000-0000-000000000002',
    'sourceUnitAmount',p_unit,'sourceCurrency',p_currency,'quantity',p_quantity,
    'eurRonRateMicros',p_rate,'amount',p_amount,'currency','RON','priceVersion',repeat('a',64));
$$;

DO $$
DECLARE v_table TEXT; v_bad JSONB; v_key TEXT;
BEGIN
    IF NOT EXISTS (SELECT FROM public.payments WHERE amount=12345 AND currency='EUR' AND pricing_snapshot IS NULL AND status='SUCCEEDED')
        OR (SELECT eur_ron_rate_micros FROM public.camps LIMIT 1) IS NOT NULL THEN
        RAISE EXCEPTION 'Migration rewrote historical values or invented a rate';
    END IF;
    FOREACH v_table IN ARRAY ARRAY['courses','activities','camps'] LOOP
        EXECUTE format('UPDATE public.%I SET currency=''EUR'',eur_ron_rate_micros=5123456',v_table);
        BEGIN
            EXECUTE format('UPDATE public.%I SET eur_ron_rate_micros=0',v_table);
            RAISE EXCEPTION 'Zero exchange rate accepted';
        EXCEPTION WHEN check_violation THEN NULL; END;
        BEGIN
            EXECUTE format('UPDATE public.%I SET currency=''RON''',v_table);
            RAISE EXCEPTION 'RON with EUR conversion accepted';
        EXCEPTION WHEN check_violation THEN NULL; END;
        BEGIN
            EXECUTE format('UPDATE public.%I SET currency=''USD''',v_table);
            RAISE EXCEPTION 'Unsupported currency accepted';
        EXCEPTION WHEN check_violation THEN NULL; END;
        EXECUTE format('UPDATE public.%I SET currency=''RON'',eur_ron_rate_micros=NULL',v_table);
        EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I',v_table,v_table||'_offer_currency_check');
    END LOOP;
    IF NOT public.valid_enrollment_price_snapshot(pg_temp.snapshot(),51235,'RON')
        OR NOT public.valid_enrollment_price_snapshot(pg_temp.snapshot('EUR',1500000,1,3,5),5,'RON')
        OR NOT public.valid_enrollment_price_snapshot(pg_temp.snapshot('EUR',1499999,1,1,1),1,'RON')
        OR NOT public.valid_enrollment_price_snapshot(pg_temp.snapshot('RON',NULL,501,3,1503),1503,'RON')
        OR NOT public.valid_enrollment_price_snapshot(pg_temp.snapshot('EUR',1,9007199254740991,1,9007199255),9007199255,'RON') THEN
        RAISE EXCEPTION 'Exact conversion/half-up arithmetic failed';
    END IF;
    FOREACH v_bad IN ARRAY ARRAY[
        '{}'::JSONB,'null'::JSONB,'[]'::JSONB,
        pg_temp.snapshot('EUR',NULL),pg_temp.snapshot('EUR',0),pg_temp.snapshot('EUR',-1),
        pg_temp.snapshot('RON',1),pg_temp.snapshot('USD',1),pg_temp.snapshot('EUR',5123456,-1),
        pg_temp.snapshot('EUR',5123456,10000,0),pg_temp.snapshot('EUR',5123456,10000,-1),
        pg_temp.snapshot('EUR',5000000,9007199254740991,1,1),
        pg_temp.snapshot()||'{"sourceUnitAmount":1.1}'::JSONB,
        pg_temp.snapshot()||'{"quantity":1.1}'::JSONB,
        pg_temp.snapshot()||'{"eurRonRateMicros":5.1}'::JSONB,
        pg_temp.snapshot()||'{"amount":"51235"}'::JSONB,
        pg_temp.snapshot()||'{"kind":"CAMP","quantity":2}'::JSONB,
        pg_temp.snapshot()||'{"childId":"invalid"}'::JSONB
    ] LOOP
        IF public.valid_enrollment_price_snapshot(v_bad,51235,'RON') THEN RAISE EXCEPTION 'Malformed snapshot accepted: %',v_bad; END IF;
    END LOOP;
    FOR v_key IN SELECT jsonb_object_keys(pg_temp.snapshot()) LOOP
        IF public.valid_enrollment_price_snapshot(pg_temp.snapshot()-v_key,51235,'RON')
            OR public.valid_enrollment_price_snapshot(jsonb_set(pg_temp.snapshot(),ARRAY[v_key],'null'),51235,'RON') THEN
            RAISE EXCEPTION 'Missing/null field accepted: %',v_key;
        END IF;
    END LOOP;
    IF public.valid_enrollment_price_snapshot(pg_temp.snapshot(),51234,'RON')
        OR public.valid_enrollment_price_snapshot(pg_temp.snapshot(),51235,'EUR') THEN RAISE EXCEPTION 'Payment mismatch accepted'; END IF;
END
$$;

SET LOCAL ROLE service_role;
INSERT INTO public.payments (id,enrollment_id,amount,currency,status,pricing_snapshot) VALUES
    ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000010',51235,'RON','PENDING',pg_temp.snapshot());
DO $$
BEGIN
    BEGIN
        UPDATE public.payments SET amount=1 WHERE pricing_snapshot IS NOT NULL;
        RAISE EXCEPTION 'Accepted amount changed';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
        UPDATE public.payments SET pricing_snapshot=NULL WHERE pricing_snapshot IS NOT NULL;
        RAISE EXCEPTION 'Snapshot was removed';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
        UPDATE public.payments SET pricing_snapshot=pg_temp.snapshot() WHERE gateway_txn_id='pi_historical';
        RAISE EXCEPTION 'Historical gateway payment repriced';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
        INSERT INTO public.payments(enrollment_id,amount,currency,status,pricing_snapshot) VALUES
            ('00000000-0000-0000-0000-000000000010',51235,'RON','PENDING',pg_temp.snapshot()||'{"childId":"00000000-0000-0000-0000-000000000099"}'::JSONB);
        RAISE EXCEPTION 'Snapshot bound to foreign child accepted';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
        INSERT INTO public.payments(enrollment_id,amount,currency,status,pricing_snapshot) VALUES
            ('00000000-0000-0000-0000-000000000010',1,'RON','PENDING',pg_temp.snapshot());
        RAISE EXCEPTION 'Forged payment amount accepted';
    EXCEPTION WHEN check_violation THEN NULL; END;
END
$$;
UPDATE public.payments SET gateway_txn_id='pi_accepted',status='SUCCEEDED' WHERE pricing_snapshot IS NOT NULL;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
BEGIN
    BEGIN
        INSERT INTO public.payments(enrollment_id,amount,currency,status,pricing_snapshot) VALUES
            ('00000000-0000-0000-0000-000000000010',51235,'RON','PENDING',pg_temp.snapshot());
        RAISE EXCEPTION 'Authenticated admin bypassed backend snapshot creation';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
        UPDATE public.payments SET amount=1 WHERE pricing_snapshot IS NOT NULL;
        RAISE EXCEPTION 'Authenticated admin rewrote accepted amount';
    EXCEPTION WHEN check_violation THEN NULL; END;
END
$$;
RESET ROLE;

DO $$
BEGIN
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.payments'::regclass)
        OR has_function_privilege('anon','public.valid_enrollment_price_snapshot(jsonb,bigint,text)','EXECUTE')
        OR EXISTS (SELECT FROM pg_proc WHERE oid IN ('public.guard_enrollment_price_snapshot()'::regprocedure,
            'public.valid_enrollment_price_snapshot(jsonb,bigint,text)'::regprocedure) AND prosecdef) THEN
        RAISE EXCEPTION 'Pricing migration altered security boundaries';
    END IF;
END
$$;
ROLLBACK;
\echo 'PASS: isolated migration, rates, exact rounding, malformed snapshots, ownership binding, immutability and roles'
