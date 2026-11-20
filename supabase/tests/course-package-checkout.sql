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
DO $load72$
DECLARE
    v_file TEXT := pg_read_file('/tmp/migrations/00072_competition_registrations.sql');
BEGIN
    EXECUTE substring(v_file FROM '(CREATE OR REPLACE FUNCTION public\.valid_enrollment_price_snapshot\(.*?\n\$\$;)');
END
$load72$;
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
CREATE FUNCTION public.pot_administra_curs(p_course_id UUID) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$ SELECT true $$;
\i /tmp/migrations/00148_course_packages.sql
\i /tmp/migrations/00149_course_package_checkout.sql


CREATE FUNCTION public.test_uuid(v INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-0000-0000-' || lpad(v::TEXT,12,'0'))::UUID
$$;
CREATE FUNCTION public.test_assert(ok BOOLEAN,label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',label; END IF; END;
$$;
CREATE FUNCTION public.test_session_quote(v_child INTEGER, v_quantity INTEGER, v_course INTEGER, v_unit BIGINT DEFAULT 1000)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT jsonb_build_object('childId',public.test_uuid(v_child),'amount',v_unit*v_quantity,'currency','RON',
        'priceVersion',repeat('c',64),
        'snapshot',jsonb_build_object('schemaVersion',1,'kind','COURSE','entityId',public.test_uuid(v_course),
            'childId',public.test_uuid(v_child),'sourceUnitAmount',v_unit,'sourceCurrency','RON','quantity',v_quantity,
            'eurRonRateMicros',null,'amount',v_unit*v_quantity,'currency','RON','priceVersion',repeat('c',64)))
$$;
CREATE FUNCTION public.test_package_snapshot(v_child INTEGER, v_course INTEGER, v_package INTEGER, v_sessions INTEGER,
    v_price BIGINT, v_currency TEXT DEFAULT 'RON', v_rate BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT jsonb_build_object('schemaVersion',3,'kind','COURSE','entityId',public.test_uuid(v_course),
        'childId',public.test_uuid(v_child),'packageId',public.test_uuid(v_package),'validity','NONE',
        'sourcePackageAmount',v_price,'sourceCurrency',v_currency,'quantity',v_sessions,'eurRonRateMicros',v_rate,
        'amount',CASE WHEN v_currency = 'EUR' THEN floor((v_price::NUMERIC * v_rate + 500000) / 1000000)::BIGINT ELSE v_price END,
        'currency','RON','priceVersion',repeat('e',64))
$$;
CREATE FUNCTION public.test_package_quote(v_child INTEGER, v_course INTEGER, v_package INTEGER, v_sessions INTEGER, v_price BIGINT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT jsonb_build_object('childId',public.test_uuid(v_child),'amount',v_price,'currency','RON',
        'priceVersion',repeat('e',64),
        'snapshot',public.test_package_snapshot(v_child,v_course,v_package,v_sessions,v_price))
$$;
CREATE FUNCTION public.test_acceptance() RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT jsonb_build_object('termsVersion','2026-10-01','termsSha256',repeat('d',64),'clientTermsVersion','2026-10-01')
$$;
CREATE FUNCTION public.test_billing() RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT jsonb_build_object('name','Ana Părinte','email','ana@example.test','addressLine1','Str. Test 1',
        'city','Timișoara','postalCode','300001')
$$;
CREATE FUNCTION public.test_try_save(v_course INTEGER, v_method TEXT, v_quote JSONB)
RETURNS TEXT LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_detail TEXT;
BEGIN
    PERFORM public.save_enrollment_batch(public.test_uuid(1), 'COURSE', public.test_uuid(v_course), v_method,
        jsonb_build_array(v_quote), CASE WHEN v_method = 'CARD' THEN public.test_billing() END);
    RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    RETURN SQLSTATE || CASE WHEN coalesce(v_detail, '') <> '' THEN ':' || v_detail ELSE '' END;
END;
$$;
CREATE FUNCTION public.test_try_renew(v_enrollment INTEGER, v_method TEXT, v_quote JSONB)
RETURNS TEXT LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_detail TEXT;
BEGIN
    PERFORM public.start_course_renewal(public.test_uuid(1), public.test_uuid(v_enrollment), v_method, v_quote,
        CASE WHEN v_method = 'CARD' THEN public.test_billing() END, public.test_acceptance());
    RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    RETURN SQLSTATE || CASE WHEN coalesce(v_detail, '') <> '' THEN ':' || v_detail ELSE '' END;
END;
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

INSERT INTO public.profiles VALUES(public.test_uuid(1),'PARENT','Ana Părinte');
INSERT INTO public.children VALUES(public.test_uuid(200),public.test_uuid(1),'2018-01-01'),
    (public.test_uuid(201),public.test_uuid(1),'2018-01-01'),(public.test_uuid(202),public.test_uuid(1),'2018-01-01'),
    (public.test_uuid(203),public.test_uuid(1),'2018-01-01');
INSERT INTO public.courses(id,currency,price_per_session) VALUES(public.test_uuid(100),'RON',1000),
    (public.test_uuid(101),'RON',1000);
INSERT INTO public.courses(id,currency,price_per_session,eur_ron_rate_micros) VALUES(public.test_uuid(102),'EUR',1000,4975000);
INSERT INTO public.course_packages(id,course_id,position,sessions,price,validity) VALUES
    (public.test_uuid(700),public.test_uuid(100),0,8,32000,'NONE'),
    (public.test_uuid(701),public.test_uuid(100),1,4,18000,'NONE'),
    (public.test_uuid(702),public.test_uuid(100),2,12,60000,'CALENDAR_MONTH'),
    (public.test_uuid(710),public.test_uuid(102),0,10,8000,'NONE');
INSERT INTO public.enrollments(id,kind,entity_id,child_id,status,purchased_sessions,remaining_sessions,sessions_used) VALUES
    (public.test_uuid(500),'COURSE',public.test_uuid(100),public.test_uuid(203),'ACTIVE',4,1,3);

SELECT public.test_assert(public.valid_enrollment_price_snapshot(public.test_package_snapshot(200,100,700,8,32000), 32000, 'RON'),
    'a package snapshot is valid');
SELECT public.test_assert(public.valid_enrollment_price_snapshot(public.test_package_snapshot(200,102,710,10,8000,'EUR',4975000), 39800, 'RON'),
    'a EUR package converts its total once, not per session');
SELECT public.test_assert(NOT public.valid_enrollment_price_snapshot(public.test_package_snapshot(200,100,700,8,32000), 256000, 'RON'),
    'a package total is not multiplied by its sessions');
SELECT public.test_assert(NOT public.valid_enrollment_price_snapshot(public.test_package_snapshot(200,100,700,8,32000) || '{"sourceUnitAmount":4000}', 32000, 'RON'),
    'unknown keys are refused');
SELECT public.test_assert(NOT public.valid_enrollment_price_snapshot(public.test_package_snapshot(200,100,700,8,32000) - 'packageId', 32000, 'RON'),
    'a package snapshot needs its package');
SELECT public.test_assert(NOT public.valid_enrollment_price_snapshot(public.test_package_snapshot(200,100,700,8,32000) || '{"validity":"CALENDAR_MONTH"}', 32000, 'RON'),
    'monthly packages are not sold before #698');
SELECT public.test_assert(NOT public.valid_enrollment_price_snapshot(public.test_package_snapshot(200,100,700,101,32000), 32000, 'RON'),
    'more than 100 sessions is refused');
SELECT public.test_assert(NOT public.valid_enrollment_price_snapshot(public.test_package_snapshot(200,100,700,8,0), 0, 'RON'),
    'a free package is refused');
SELECT public.test_assert(NOT public.valid_enrollment_price_snapshot(public.test_package_snapshot(200,100,700,8,32000) || '{"kind":"CAMP"}', 32000, 'RON'),
    'only courses sell packages');
SELECT public.test_assert(public.valid_enrollment_price_snapshot(public.test_session_quote(200,5,101)->'snapshot', 5000, 'RON'),
    'per-session snapshots stay valid');
SELECT public.test_assert(NOT has_function_privilege('authenticated','public.course_quote_matches_offer(uuid,jsonb)','EXECUTE')
    AND NOT has_function_privilege('anon','public.course_quote_matches_offer(uuid,jsonb)','EXECUTE'),
    'clients cannot call the offer check');
SELECT public.test_assert(has_function_privilege('authenticated','public.valid_course_package_price_snapshot(jsonb,bigint,text)','EXECUTE'),
    'the payments CHECK constraint can run for authenticated writers');

SET LOCAL ROLE service_role;

SELECT public.test_assert(public.test_try_save(100,'CASH',public.test_session_quote(200,8,100)) = '23514:PRICE_CHANGED',
    'a course with packages refuses the per-session price');
SELECT public.test_assert(public.test_try_save(100,'CASH',jsonb_set(public.test_package_quote(200,100,700,8,32000),'{amount}','30000')) = '23514',
    'a client-chosen package price that does not match its amount is refused');
SELECT public.test_assert(public.test_try_save(100,'CASH',public.test_package_quote(200,100,700,8,30000)) = '23514:PRICE_CHANGED',
    'a package price lower than the course package is refused');
SELECT public.test_assert(public.test_try_save(100,'CASH',public.test_package_quote(200,100,700,9,32000)) = '23514:PRICE_CHANGED',
    'a package with different sessions is refused');
SELECT public.test_assert(public.test_try_save(100,'CASH',public.test_package_quote(200,100,710,10,8000)) = '23514:PRICE_CHANGED',
    'another course''s package is refused');
SELECT public.test_assert(public.test_try_save(100,'CASH',public.test_package_quote(200,100,799,8,32000)) = '23514:PRICE_CHANGED',
    'an unknown package is refused');
SELECT public.test_assert(public.test_try_save(101,'CASH',public.test_package_quote(200,101,700,8,32000)) = '23514:PRICE_CHANGED',
    'a course without packages refuses package snapshots');
SELECT public.test_assert(public.test_try_save(101,'CASH',public.test_session_quote(200,5,101)) = 'OK',
    'a course without packages still sells per-session as before');
SELECT public.test_assert((SELECT count(*) FROM public.payments) = 1, 'refused purchases write nothing');

DO $$
DECLARE v_result JSONB; v_payment UUID;
BEGIN
    v_result := public.save_enrollment_batch(public.test_uuid(1), 'COURSE', public.test_uuid(100), 'CASH',
        jsonb_build_array(public.test_package_quote(201,100,700,8,32000)), NULL);
    SELECT id INTO v_payment FROM public.payments WHERE enrollment_id = (v_result->>'enrollmentId')::UUID;
    PERFORM public.test_assert((SELECT amount = 32000 AND method = 'CASH' AND status = 'PENDING'
        AND pricing_snapshot->>'packageId' = public.test_uuid(700)::TEXT FROM public.payments WHERE id = v_payment),
        'a cash package purchase waits with the package price');
    PERFORM public.apply_enrollment_payment_result(v_payment, 'SUCCEEDED', 32000, 'RON', 'CASH', NULL);
    PERFORM public.test_assert((SELECT status = 'ACTIVE' AND purchased_sessions = 8 AND remaining_sessions = 8
        FROM public.enrollments WHERE id = (v_result->>'enrollmentId')::UUID), 'a confirmed package adds its sessions');

    v_result := public.save_enrollment_batch(public.test_uuid(1), 'COURSE', public.test_uuid(100), 'CARD',
        jsonb_build_array(public.test_package_quote(202,100,701,4,18000)), public.test_billing());
    PERFORM public.test_assert((v_result->>'requiresPaymentIntent')::BOOLEAN, 'a card package needs a card payment');
    SELECT id INTO v_payment FROM public.payments WHERE enrollment_id = (v_result->>'enrollmentId')::UUID;
    UPDATE public.payments SET gateway_txn_id = 'pi_package' WHERE id = v_payment;
    PERFORM public.apply_enrollment_payment_result(v_payment, 'SUCCEEDED', 18000, 'RON', 'CARD', 'pi_package');
    PERFORM public.test_assert((SELECT purchased_sessions = 4 AND remaining_sessions = 4
        FROM public.enrollments WHERE id = (v_result->>'enrollmentId')::UUID), 'a confirmed card package adds its sessions');
END;
$$;

SELECT public.test_assert(public.test_try_renew(500,'CASH',public.test_session_quote(203,8,100)) = '23514:PRICE_CHANGED',
    'a renewal on a course with packages refuses the per-session price');
SELECT public.test_assert(public.test_try_renew(500,'CASH',public.test_package_quote(203,100,702,12,60000)) = '23514:PRICE_CHANGED',
    'a monthly package cannot be bought as a no-expiry one');
SELECT public.test_assert(public.test_try_renew(500,'CASH',jsonb_set(public.test_package_quote(203,100,702,12,60000),
    '{snapshot,validity}','"CALENDAR_MONTH"')) = '23514:RENEWAL_REFUSED', 'a monthly package is not sold before #698');

DO $$
DECLARE v_result JSONB;
BEGIN
    v_result := public.start_course_renewal(public.test_uuid(1), public.test_uuid(500), 'CASH',
        public.test_package_quote(203,100,700,8,32000), NULL, public.test_acceptance());
    PERFORM public.test_assert((v_result->>'sessions')::INTEGER = 8, 'a package renewal buys the package sessions');
    PERFORM public.apply_enrollment_payment_result((v_result->>'paymentId')::UUID, 'SUCCEEDED', 32000, 'RON', 'CASH', NULL);
    PERFORM public.test_assert((SELECT purchased_sessions = 12 AND remaining_sessions = 9 AND sessions_used = 3
        FROM public.enrollments WHERE id = public.test_uuid(500)), 'a confirmed package renewal adds to the remaining sessions');
END;
$$;

RESET ROLE;
UPDATE public.course_packages SET price = 34000 WHERE id = public.test_uuid(700);
SET LOCAL ROLE service_role;
SELECT public.test_assert(public.test_try_renew(500,'CASH',public.test_package_quote(203,100,700,8,32000)) = '23514:PRICE_CHANGED',
    'a package repriced by the coach refuses the old price');
SELECT public.test_assert(public.test_try_renew(500,'CASH',public.test_package_quote(203,100,700,8,34000)) = 'OK',
    'the new package price is accepted');
RESET ROLE;
DELETE FROM public.course_packages WHERE course_id = public.test_uuid(100);
SET LOCAL ROLE service_role;
SELECT public.test_assert(public.test_try_save(100,'CASH',public.test_session_quote(200,5,100)) = 'OK',
    'when the coach removes every package the course is per-session again');

RESET ROLE;
ROLLBACK;
\echo 'course-package-checkout: all assertions passed'
