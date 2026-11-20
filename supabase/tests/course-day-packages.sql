\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
CREATE TABLE public.profiles(id UUID PRIMARY KEY, role TEXT NOT NULL, name TEXT NOT NULL DEFAULT 'Profil',
    enabled BOOLEAN NOT NULL DEFAULT true, deleted_at TIMESTAMPTZ);
CREATE TABLE public.clubs(id UUID PRIMARY KEY, owner_user_id UUID REFERENCES public.profiles(id), approved_at TIMESTAMPTZ);
CREATE TABLE public.children(id UUID PRIMARY KEY, parent_id UUID NOT NULL REFERENCES public.profiles(id),
    birth_date DATE NOT NULL DEFAULT '2018-01-01', name TEXT NOT NULL DEFAULT 'Copil', qr_token TEXT UNIQUE);
CREATE TABLE public.courses(id UUID PRIMARY KEY, currency TEXT NOT NULL DEFAULT 'RON', price_per_session BIGINT NOT NULL DEFAULT 1000,
    active BOOLEAN NOT NULL DEFAULT true, capacity INTEGER, age_from INTEGER, age_to INTEGER, club_id UUID REFERENCES public.clubs(id),
    coach_id UUID REFERENCES public.profiles(id), name TEXT NOT NULL DEFAULT 'Curs');
CREATE TABLE public.activities(id UUID PRIMARY KEY, currency TEXT NOT NULL, price BIGINT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true, capacity INTEGER, coach_id UUID);
CREATE TABLE public.camps(id UUID PRIMARY KEY, currency TEXT NOT NULL, price BIGINT NOT NULL,
    capacity INTEGER, allow_cash BOOLEAN NOT NULL DEFAULT true, pricing_mode TEXT NOT NULL DEFAULT 'by_age');
CREATE TABLE public.course_occurrences(id UUID PRIMARY KEY, course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(), ends_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE public.enrollments(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), kind TEXT NOT NULL,
    entity_id UUID NOT NULL, child_id UUID REFERENCES public.children(id), status TEXT NOT NULL DEFAULT 'PENDING',
    purchased_sessions INTEGER NOT NULL DEFAULT 0, remaining_sessions INTEGER NOT NULL DEFAULT 0,
    sessions_used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE public.payments(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), enrollment_id UUID NOT NULL REFERENCES public.enrollments(id),
    method TEXT NOT NULL, amount BIGINT NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING',
    gateway_txn_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ, billing_name TEXT, billing_email TEXT, billing_address_line1 TEXT, billing_city TEXT,
    billing_postal_code TEXT, billing_country TEXT);
CREATE TABLE public.payment_intent_requests(id UUID PRIMARY KEY REFERENCES public.payments(id) ON DELETE CASCADE,
    params JSONB NOT NULL DEFAULT '{}'::JSONB);
CREATE TABLE public.attendance(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id UUID NOT NULL REFERENCES public.course_occurrences(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT')), UNIQUE (occurrence_id, child_id));
CREATE FUNCTION public.get_my_role() RETURNS TEXT LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')
$$;
CREATE FUNCTION public.my_child_ids() RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
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
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.courses, public.course_occurrences, public.children, public.enrollments, public.attendance TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
\i /tmp/migrations/00042_transactional_attendance.sql
\i /tmp/migrations/00105_attendance_after_session_start.sql
\i /tmp/migrations/00142_parent_entrance_checkin.sql
\i /tmp/migrations/00144_club_manual_attendance.sql
\i /tmp/migrations/00048_enrollment_price_snapshots.sql
\i /tmp/migrations/00050_atomic_enrollment_payment_completion.sql
CREATE FUNCTION public.enrollment_camp_offer(p_camp_id UUID,p_child_id UUID) RETURNS JSONB
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
    SELECT jsonb_build_object('amount',price,'currency',currency,'eur_ron_rate_micros',eur_ron_rate_micros)
    FROM public.camps WHERE id=p_camp_id
$$;
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
CREATE FUNCTION public.enrollment_offer_has_access(p_kind TEXT, p_entity_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT true $$;
\i /tmp/migrations/00147_course_session_renewal.sql
CREATE FUNCTION public.pot_administra_curs(p_course_id UUID) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$ SELECT true $$;
\i /tmp/migrations/00148_course_packages.sql
\i /tmp/migrations/00149_course_package_checkout.sql
\i /tmp/migrations/00150_course_monthly_packages.sql
\i /tmp/migrations/00151_course_monthly_package_attendance.sql
\i /tmp/migrations/00152_course_day_packages.sql

CREATE FUNCTION public.test_uuid(v INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-0000-0000-' || lpad(v::TEXT,12,'0'))::UUID
$$;
CREATE FUNCTION public.test_assert(ok BOOLEAN,label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %',label; END IF; END;
$$;
CREATE FUNCTION public.test_month(v_offset INTEGER) RETURNS TEXT LANGUAGE sql STABLE AS $$
    SELECT to_char(date_trunc('month', (now() AT TIME ZONE 'Europe/Bucharest')) + make_interval(months => v_offset), 'YYYY-MM')
$$;
CREATE FUNCTION public.test_monthly_snapshot(v_child INTEGER, v_course INTEGER, v_package INTEGER, v_sessions INTEGER,
    v_price BIGINT, v_month TEXT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT jsonb_build_object('schemaVersion',3,'kind','COURSE','entityId',public.test_uuid(v_course),
        'childId',public.test_uuid(v_child),'packageId',public.test_uuid(v_package),'validity','CALENDAR_MONTH',
        'validMonth',v_month,'sourcePackageAmount',v_price,'sourceCurrency','RON','quantity',v_sessions,
        'eurRonRateMicros',null,'amount',v_price,'currency','RON','priceVersion',repeat('e',64))
$$;
CREATE FUNCTION public.test_none_snapshot(v_child INTEGER, v_course INTEGER, v_package INTEGER, v_sessions INTEGER, v_price BIGINT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT public.test_monthly_snapshot(v_child, v_course, v_package, v_sessions, v_price, '2026-01')
        - 'validMonth' || '{"validity":"NONE"}'
$$;
CREATE FUNCTION public.test_quote(v_snapshot JSONB) RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT jsonb_build_object('childId',v_snapshot->'childId','amount',v_snapshot->'amount','currency','RON',
        'priceVersion',v_snapshot->'priceVersion','snapshot',v_snapshot)
$$;
CREATE FUNCTION public.test_acceptance() RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT jsonb_build_object('termsVersion','2026-10-01','termsSha256',repeat('d',64),'clientTermsVersion','2026-10-01')
$$;
CREATE FUNCTION public.test_try(v_sql TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v_detail TEXT;
BEGIN
    EXECUTE v_sql;
    RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    RETURN SQLSTATE || CASE WHEN coalesce(v_detail, '') <> '' THEN ':' || v_detail ELSE '' END;
END;
$$;
CREATE FUNCTION public.test_mark(req INTEGER, child INTEGER, status TEXT, occurrence INTEGER, actor INTEGER DEFAULT 1)
RETURNS JSONB LANGUAGE sql AS $$
    SELECT public.record_attendance_transaction(public.test_uuid(actor), jsonb_build_object(
        'requestId', public.test_uuid(10000 + req), 'occurrenceId', public.test_uuid(occurrence),
        'status', status, 'childId', public.test_uuid(child)))
$$;
CREATE FUNCTION public.test_scan(req INTEGER, child INTEGER, occurrence INTEGER) RETURNS JSONB LANGUAGE sql AS $$
    SELECT public.record_attendance_transaction(public.test_uuid(1), jsonb_build_object(
        'requestId', public.test_uuid(20000 + req), 'occurrenceId', public.test_uuid(occurrence),
        'status', 'PRESENT', 'qrToken', md5(public.test_uuid(child)::TEXT)))
$$;
CREATE FUNCTION public.test_bulk(req INTEGER, children INTEGER[], occurrence INTEGER) RETURNS JSONB LANGUAGE sql AS $$
    SELECT public.record_attendance_transaction(public.test_uuid(1), jsonb_build_object(
        'requestId', public.test_uuid(30000 + req), 'occurrenceId', public.test_uuid(occurrence),
        'status', 'PRESENT', 'onlyUnmarked', true,
        'childIds', (SELECT jsonb_agg(public.test_uuid(c)) FROM unnest(children) c)))
$$;
CREATE FUNCTION public.test_add_package(v_id INTEGER, v_enrollment INTEGER, v_sessions INTEGER, v_month DATE,
    v_used INTEGER DEFAULT 0, v_created TIMESTAMPTZ DEFAULT now())
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_payment UUID := gen_random_uuid();
BEGIN
    INSERT INTO public.payments(id, enrollment_id, method, amount, currency, status)
        VALUES (v_payment, public.test_uuid(v_enrollment), 'CASH', 1000, 'RON', 'SUCCEEDED');
    INSERT INTO public.enrollment_monthly_packages(id, enrollment_id, payment_id, sessions, sessions_used,
        valid_from, valid_until, created_at)
        VALUES (public.test_uuid(v_id), public.test_uuid(v_enrollment), v_payment, v_sessions, v_used,
            v_month, (v_month + INTERVAL '1 month' - INTERVAL '1 day')::DATE, v_created);
END;
$$;
CREATE FUNCTION public.test_used(v_package INTEGER) RETURNS INTEGER LANGUAGE sql AS $$
    SELECT sessions_used FROM public.enrollment_monthly_packages WHERE id = public.test_uuid(v_package)
$$;
CREATE FUNCTION public.test_pool(v_enrollment INTEGER) RETURNS TEXT LANGUAGE sql AS $$
    SELECT remaining_sessions || '/' || sessions_used FROM public.enrollments WHERE id = public.test_uuid(v_enrollment)
$$;
CREATE FUNCTION public.test_token(coach INTEGER) RETURNS TEXT LANGUAGE sql SECURITY DEFINER AS $$
    SELECT token FROM public.coach_entrance_codes WHERE coach_id = public.test_uuid(coach)
$$;

CREATE FUNCTION public.test_days_snapshot(v_child INTEGER, v_course INTEGER, v_package INTEGER, v_sessions INTEGER,
    v_price BIGINT, v_days JSONB)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT public.test_none_snapshot(v_child, v_course, v_package, v_sessions, v_price)
        || jsonb_build_object('validity', 'DAYS', 'validDays', v_days)
$$;
CREATE FUNCTION public.test_add_days(v_id INTEGER, v_enrollment INTEGER, v_sessions INTEGER, v_from DATE, v_days INTEGER,
    v_used INTEGER DEFAULT 0)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_payment UUID := gen_random_uuid();
BEGIN
    INSERT INTO public.payments(id, enrollment_id, method, amount, currency, status)
        VALUES (v_payment, public.test_uuid(v_enrollment), 'CASH', 1000, 'RON', 'SUCCEEDED');
    INSERT INTO public.enrollment_monthly_packages(id, enrollment_id, payment_id, sessions, sessions_used,
        valid_from, valid_until, validity)
        VALUES (public.test_uuid(v_id), public.test_uuid(v_enrollment), v_payment, v_sessions, v_used,
            v_from, v_from + (v_days - 1), 'DAYS');
END;
$$;

INSERT INTO auth.users(id) SELECT public.test_uuid(n) FROM generate_series(1, 9) n;
INSERT INTO public.profiles(id, role, name) VALUES
    (public.test_uuid(1), 'COACH', 'Antrenor'), (public.test_uuid(2), 'PARENT', 'Părinte');
INSERT INTO public.courses(id, coach_id, name) VALUES
    (public.test_uuid(100), public.test_uuid(1), 'Înot'), (public.test_uuid(101), public.test_uuid(1), 'Alergare');
INSERT INTO public.course_packages(id, course_id, position, sessions, price, validity, validity_days) VALUES
    (public.test_uuid(700), public.test_uuid(100), 0, 8, 32000, 'DAYS', 45),
    (public.test_uuid(701), public.test_uuid(100), 1, 12, 45000, 'DAYS', 45);
INSERT INTO public.children(id, parent_id, name, qr_token)
    SELECT public.test_uuid(n), public.test_uuid(2), 'Copil ' || n, md5(public.test_uuid(n)::TEXT) FROM generate_series(201, 210) n;
INSERT INTO public.enrollments(id, kind, entity_id, child_id, status, purchased_sessions, remaining_sessions)
    SELECT public.test_uuid(n + 1000), 'COURSE', public.test_uuid(100), public.test_uuid(n), 'ACTIVE', 0, 0
    FROM generate_series(201, 210) n;
UPDATE public.enrollments SET purchased_sessions = 2, remaining_sessions = 2 WHERE id = public.test_uuid(1205);
INSERT INTO public.course_occurrences(id, course_id, starts_at, ends_at) VALUES
    (public.test_uuid(901), public.test_uuid(100), '2026-03-01 16:00+02', '2026-03-01 17:00+02'),
    (public.test_uuid(902), public.test_uuid(100), '2026-03-10 16:00+02', '2026-03-10 17:00+02'),
    (public.test_uuid(903), public.test_uuid(100), '2026-04-14 23:30+03', '2026-04-15 00:20+03'),
    (public.test_uuid(904), public.test_uuid(100), '2026-04-15 00:30+03', '2026-04-15 01:20+03'),
    (public.test_uuid(905), public.test_uuid(100), '2026-02-27 16:00+02', '2026-02-27 17:00+02'),
    (public.test_uuid(906), public.test_uuid(100), '2026-03-20 16:00+02', '2026-03-20 17:00+02');

SELECT public.test_assert(public.valid_enrollment_price_snapshot(public.test_days_snapshot(201,100,700,8,32000,'45'), 32000, 'RON'),
    'a DAYS snapshot with its number of days is valid');
SELECT public.test_assert(NOT public.valid_enrollment_price_snapshot(public.test_days_snapshot(201,100,700,8,32000,'45') - 'validDays', 32000, 'RON'),
    'a DAYS snapshot without its days is refused');
SELECT public.test_assert(NOT public.valid_enrollment_price_snapshot(public.test_days_snapshot(201,100,700,8,32000,'6'), 32000, 'RON')
    AND NOT public.valid_enrollment_price_snapshot(public.test_days_snapshot(201,100,700,8,32000,'366'), 32000, 'RON')
    AND NOT public.valid_enrollment_price_snapshot(public.test_days_snapshot(201,100,700,8,32000,'45.5'), 32000, 'RON')
    AND NOT public.valid_enrollment_price_snapshot(public.test_days_snapshot(201,100,700,8,32000,'"45"'), 32000, 'RON'),
    'days outside 7..365, fractional or as text are refused');
SELECT public.test_assert(public.valid_enrollment_price_snapshot(public.test_days_snapshot(201,100,700,8,32000,'7'), 32000, 'RON')
    AND public.valid_enrollment_price_snapshot(public.test_days_snapshot(201,100,700,8,32000,'365'), 32000, 'RON'),
    'the limits 7 and 365 are allowed');
SELECT public.test_assert(NOT public.valid_enrollment_price_snapshot(
    public.test_days_snapshot(201,100,700,8,32000,'45') - 'validDays' || '{"validMonth":"2026-11"}', 32000, 'RON'),
    'a DAYS snapshot cannot carry a month instead of days');
SELECT public.test_assert(NOT public.valid_enrollment_price_snapshot(public.test_none_snapshot(201,100,700,8,32000) || '{"validDays":45}', 32000, 'RON')
    AND NOT public.valid_enrollment_price_snapshot(public.test_monthly_snapshot(201,100,700,8,32000,'2026-11') || '{"validDays":45}', 32000, 'RON'),
    'NONE and monthly snapshots cannot carry days');
SELECT public.test_assert(public.valid_enrollment_price_snapshot(public.test_monthly_snapshot(201,100,700,8,32000,'2026-11'), 32000, 'RON')
    AND public.valid_enrollment_price_snapshot(public.test_none_snapshot(201,100,700,8,32000), 32000, 'RON'),
    'monthly and NONE snapshots keep their 00150 shape');

SELECT public.test_assert(public.course_quote_matches_offer(public.test_uuid(100), public.test_days_snapshot(201,100,700,8,32000,'45')),
    'a DAYS package sells with the course''s number of days');
SELECT public.test_assert(NOT public.course_quote_matches_offer(public.test_uuid(100), public.test_days_snapshot(201,100,700,8,32000,'30')),
    'a quote with other days than the course is refused');
SELECT public.test_assert(NOT public.course_quote_matches_offer(public.test_uuid(100), public.test_none_snapshot(201,100,700,8,32000))
    AND NOT public.course_quote_matches_offer(public.test_uuid(100), public.test_monthly_snapshot(201,100,700,8,32000,public.test_month(0))),
    'a DAYS package cannot be sold as NONE or monthly');

DO $$
DECLARE v_rows INTEGER;
BEGIN
    SELECT count(*) INTO v_rows FROM public.save_course_packages(public.test_uuid(101),
        '[{"sessions":8,"price":30000,"validity":"DAYS","validityDays":45},{"sessions":4,"price":18000,"validity":"DAYS","validityDays":45}]');
    PERFORM public.test_assert(v_rows = 2 AND (SELECT bool_and(validity = 'DAYS' AND validity_days = 45)
        FROM public.course_packages WHERE course_id = public.test_uuid(101)), 'the coach saves packages that expire after 45 days');
    SELECT count(*) INTO v_rows FROM public.save_course_packages(public.test_uuid(101), (
        SELECT jsonb_agg(jsonb_build_object('id', id, 'sessions', sessions, 'price', price, 'validity', 'DAYS', 'validityDays', 60) ORDER BY position)
        FROM public.course_packages WHERE course_id = public.test_uuid(101)));
    PERFORM public.test_assert((SELECT bool_and(validity_days = 60) FROM public.course_packages WHERE course_id = public.test_uuid(101)),
        'changing N updates every package of the course');
    PERFORM public.test_assert(public.test_try(format('SELECT * FROM public.save_course_packages(%L, %L)', public.test_uuid(101), (
        SELECT jsonb_agg(jsonb_build_object('id', id, 'sessions', sessions, 'price', price, 'validity', 'NONE') ORDER BY position)
        FROM public.course_packages WHERE course_id = public.test_uuid(101)))) = '22023'
        AND (SELECT bool_and(validity = 'DAYS') FROM public.course_packages WHERE course_id = public.test_uuid(101)),
        'an old client without validityDays cannot turn DAYS packages into packages without expiry');
    SELECT count(*) INTO v_rows FROM public.save_course_packages(public.test_uuid(101),
        '[{"sessions":8,"price":30000,"validity":"NONE","validityDays":null}]');
    PERFORM public.test_assert((SELECT validity_days IS NULL AND validity = 'NONE' FROM public.course_packages
        WHERE course_id = public.test_uuid(101)), 'going back to no expiry clears the days');
END $$;
SELECT public.test_assert(public.test_try($q$SELECT * FROM public.save_course_packages(public.test_uuid(101),
    '[{"sessions":8,"price":30000,"validity":"DAYS","validityDays":45},{"sessions":4,"price":18000,"validity":"NONE"}]')$q$) = '22023',
    'DAYS packages cannot be mixed with packages without expiry');
SELECT public.test_assert(public.test_try($q$SELECT * FROM public.save_course_packages(public.test_uuid(101),
    '[{"sessions":8,"price":30000,"validity":"DAYS","validityDays":45},{"sessions":4,"price":18000,"validity":"DAYS","validityDays":30}]')$q$) = '22023',
    'all DAYS packages of a course have the same number of days');
SELECT public.test_assert(public.test_try($q$SELECT * FROM public.save_course_packages(public.test_uuid(101),
    '[{"sessions":8,"price":30000,"validity":"CALENDAR_MONTH"},{"sessions":4,"price":18000,"validity":"NONE"}]')$q$) = '22023',
    'monthly packages cannot be mixed with packages without expiry either');
SELECT public.test_assert((SELECT count(*) FROM public.save_course_packages(public.test_uuid(101),
    '[{"sessions":8,"price":30000,"validity":"CALENDAR_MONTH"},{"sessions":4,"price":18000,"validity":"CALENDAR_MONTH"}]')) = 2,
    'a list with one validity still saves');
SELECT public.test_assert(public.test_try($q$SELECT * FROM public.save_course_packages(public.test_uuid(101),
    '[{"sessions":8,"price":30000,"validity":"DAYS"}]')$q$) LIKE '23514%', 'DAYS needs a number of days');
SELECT public.test_assert(public.test_try($q$SELECT * FROM public.save_course_packages(public.test_uuid(101),
    '[{"sessions":8,"price":30000,"validity":"DAYS","validityDays":6}]')$q$) LIKE '23514%'
    AND public.test_try($q$SELECT * FROM public.save_course_packages(public.test_uuid(101),
    '[{"sessions":8,"price":30000,"validity":"DAYS","validityDays":366}]')$q$) LIKE '23514%', 'N stays between 7 and 365');
SELECT public.test_assert(public.test_try($q$SELECT * FROM public.save_course_packages(public.test_uuid(101),
    '[{"sessions":8,"price":30000,"validity":"NONE","validityDays":45}]')$q$) LIKE '23514%', 'only DAYS packages carry days');
SELECT public.test_assert(public.test_try($q$SELECT * FROM public.save_course_packages(public.test_uuid(101),
    '[{"sessions":8,"price":30000,"validity":"WEEKLY"}]')$q$) LIKE '23514%', 'unknown validities are refused');

SET LOCAL ROLE service_role;
DO $$
DECLARE v_result JSONB; v_payment UUID; v_today DATE := public.bucharest_date(now());
BEGIN
    v_result := public.start_course_renewal(public.test_uuid(2), public.test_uuid(1201), 'CASH',
        public.test_quote(public.test_days_snapshot(201,100,700,8,32000,'45')), NULL, public.test_acceptance());
    v_payment := (v_result->>'paymentId')::UUID;
    PERFORM public.test_assert(NOT EXISTS (SELECT 1 FROM public.enrollment_monthly_packages WHERE payment_id = v_payment),
        'a cash DAYS package waits for the coach and starts no days yet');
    v_result := public.apply_enrollment_payment_result(v_payment, 'SUCCEEDED', 32000, 'RON', 'CASH', NULL);
    PERFORM public.test_assert((v_result->>'sessionsAdded')::INTEGER = 8, 'confirmation reports the package sessions');
    PERFORM public.test_assert((SELECT validity = 'DAYS' AND valid_from = v_today AND valid_until = v_today + 44
            AND sessions = 8 AND sessions_used = 0 AND package_id = public.test_uuid(700)
        FROM public.enrollment_monthly_packages WHERE payment_id = v_payment),
        'the 45 days run from the confirmation day, which counts as day 1');
    PERFORM public.test_assert(public.test_pool(1201) = '0/0', 'a DAYS package does not touch the never-expiring balance');
    PERFORM public.apply_enrollment_payment_result(v_payment, 'SUCCEEDED', 32000, 'RON', 'CASH', NULL);
    PERFORM public.test_assert((SELECT count(*) FROM public.enrollment_monthly_packages WHERE payment_id = v_payment) = 1,
        'confirming twice creates the package once');
    PERFORM public.test_assert(public.test_try(format('SELECT public.start_course_renewal(%L, %L, ''CASH'', %L, NULL, %L)',
        public.test_uuid(2), public.test_uuid(1202),
        public.test_quote(public.test_days_snapshot(202,100,700,8,32000,'30')), public.test_acceptance()))
        = '23514:PRICE_CHANGED', 'a renewal quoted with other days than the course is refused');
END $$;
RESET ROLE;

SELECT public.test_assert(public.test_try($q$INSERT INTO public.enrollment_monthly_packages(enrollment_id, payment_id, sessions,
    valid_from, valid_until, validity) VALUES (public.test_uuid(1209), (SELECT id FROM public.payments LIMIT 1), 1,
    '2026-03-05', '2026-03-10', 'DAYS')$q$) LIKE '23514%', 'a DAYS package lasts at least 7 days');
SELECT public.test_assert(public.test_try($q$INSERT INTO public.enrollment_monthly_packages(enrollment_id, payment_id, sessions,
    valid_from, valid_until) VALUES (public.test_uuid(1209), gen_random_uuid(), 1, '2026-03-05', '2026-04-04')$q$) LIKE '23514%',
    'a monthly package still covers exactly one calendar month');

SELECT public.test_add_days(801, 1203, 1, '2026-03-01', 45);
SELECT public.test_add_days(802, 1203, 3, '2026-03-05', 45);
SELECT public.test_assert(public.test_mark(1, 203, 'PRESENT', 902)->>'success' = 'true'
    AND public.test_used(801) = 1 AND public.test_used(802) = 0,
    'with two DAYS packages the one that expires first is used first; the newer one keeps its own expiry');
SELECT public.test_assert(public.test_mark(2, 203, 'PRESENT', 906)->>'success' = 'true' AND public.test_used(802) = 1,
    'once the older package is used up the newer one is used');
SELECT public.test_assert((public.test_mark(3, 203, 'ABSENT', 902)->>'success')::BOOLEAN AND public.test_used(801) = 0,
    'undoing a mark gives the session back to the same package');

SELECT public.test_add_days(803, 1204, 4, '2026-03-01', 45);
SELECT public.test_assert(public.test_mark(10, 204, 'PRESENT', 903)->>'success' = 'true' AND public.test_used(803) = 1,
    'day 45 (14 April, 23:30 in Bucharest) is still covered');
SELECT public.test_assert(public.test_mark(11, 204, 'PRESENT', 904)->>'code' = 'PACKAGE_EXPIRED' AND public.test_used(803) = 1,
    'after midnight on day 45 the package has expired and the mark is refused');
SELECT public.test_assert(public.test_mark(12, 204, 'PRESENT', 905)->>'code' = 'PACKAGE_NOT_STARTED',
    'a session before the payment was confirmed is not covered');
SELECT public.test_assert(public.test_scan(13, 204, 904)->>'code' = 'PACKAGE_EXPIRED', 'scan refuses an expired DAYS package too');

SELECT public.test_add_days(804, 1205, 1, '2026-03-01', 45);
SELECT public.test_assert(public.test_mark(20, 205, 'PRESENT', 901)->>'success' = 'true' AND public.test_used(804) = 1
    AND public.test_pool(1205) = '2/0', 'the DAYS package is used before never-expiring sessions');
SELECT public.test_assert(public.test_mark(21, 205, 'PRESENT', 904)->>'success' = 'true' AND public.test_pool(1205) = '1/1',
    'after it expires the never-expiring sessions are still usable');

SELECT public.test_add_days(805, 1206, 2, '2026-03-01', 45);
SELECT public.test_add_days(806, 1207, 2, '2026-03-01', 45);
SELECT public.test_assert(public.test_bulk(30, ARRAY[206, 207], 902)->>'success' = 'true'
    AND public.test_used(805) = 1 AND public.test_used(806) = 1, '„Toți prezenți” uses each child''s DAYS package');

ROLLBACK;
\echo 'course-day-packages: all assertions passed'
