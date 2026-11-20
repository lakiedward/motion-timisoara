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

INSERT INTO auth.users(id) SELECT public.test_uuid(n) FROM generate_series(1, 9) n;
INSERT INTO public.profiles(id, role, name) VALUES
    (public.test_uuid(1), 'COACH', 'Antrenor'), (public.test_uuid(2), 'PARENT', 'Părinte'),
    (public.test_uuid(3), 'CLUB', 'Club'), (public.test_uuid(4), 'PARENT', 'Alt părinte');
INSERT INTO public.clubs(id, owner_user_id, approved_at) VALUES (public.test_uuid(50), public.test_uuid(3), now());
INSERT INTO public.courses(id, coach_id, club_id, name) VALUES
    (public.test_uuid(100), public.test_uuid(1), public.test_uuid(50), 'Înot'),
    (public.test_uuid(101), public.test_uuid(1), NULL, 'Alergare');
INSERT INTO public.course_packages(id, course_id, position, sessions, price, validity) VALUES
    (public.test_uuid(700), public.test_uuid(100), 0, 8, 32000, 'CALENDAR_MONTH'),
    (public.test_uuid(701), public.test_uuid(100), 1, 4, 20000, 'NONE');
INSERT INTO public.children(id, parent_id, name, qr_token)
    SELECT public.test_uuid(n), public.test_uuid(2), 'Copil ' || n, md5(public.test_uuid(n)::TEXT) FROM generate_series(201, 215) n;
INSERT INTO public.children(id, parent_id, name, qr_token) VALUES
    (public.test_uuid(301), public.test_uuid(4), 'Copil străin', md5(public.test_uuid(301)::TEXT));
INSERT INTO public.enrollments(id, kind, entity_id, child_id, status, purchased_sessions, remaining_sessions)
    SELECT public.test_uuid(n + 1000), 'COURSE', public.test_uuid(100), public.test_uuid(n), 'ACTIVE', 0, 0
    FROM generate_series(201, 215) n;
INSERT INTO public.enrollments(id, kind, entity_id, child_id, status, purchased_sessions, remaining_sessions) VALUES
    (public.test_uuid(1301), 'COURSE', public.test_uuid(100), public.test_uuid(301), 'ACTIVE', 0, 0);
UPDATE public.enrollments SET purchased_sessions = 2, remaining_sessions = 2 WHERE id IN (public.test_uuid(1201), public.test_uuid(1206));

INSERT INTO public.course_occurrences(id, course_id, starts_at, ends_at) VALUES
    (public.test_uuid(901), public.test_uuid(100), '2026-01-15 16:00+02', '2026-01-15 17:00+02'),
    (public.test_uuid(902), public.test_uuid(100), '2026-01-31 23:30+02', '2026-02-01 00:20+02'),
    (public.test_uuid(903), public.test_uuid(100), '2026-02-01 00:30+02', '2026-02-01 01:20+02'),
    (public.test_uuid(904), public.test_uuid(100), '2026-01-20 16:00+02', '2026-01-20 17:00+02'),
    (public.test_uuid(905), public.test_uuid(100), '2026-01-22 16:00+02', '2026-01-22 17:00+02'),
    (public.test_uuid(906), public.test_uuid(100), now() - INTERVAL '5 minutes', now() + INTERVAL '55 minutes');

SELECT public.test_assert(public.bucharest_date('2026-01-31 22:30+00') = '2026-02-01',
    'after midnight in Bucharest it is already the next day, although UTC is still on the 31st');
SELECT public.test_assert(public.bucharest_date('2026-01-31 21:30+00') = '2026-01-31', 'before midnight stays on the 31st');
SELECT public.test_assert(public.valid_enrollment_price_snapshot(public.test_monthly_snapshot(201,100,700,8,32000,'2026-11'), 32000, 'RON'),
    'a monthly snapshot with its month is valid');
SELECT public.test_assert(NOT public.valid_enrollment_price_snapshot(public.test_monthly_snapshot(201,100,700,8,32000,'2026-11') - 'validMonth', 32000, 'RON'),
    'a monthly snapshot without its month is refused');
SELECT public.test_assert(NOT public.valid_enrollment_price_snapshot(public.test_monthly_snapshot(201,100,700,8,32000,'2026-13'), 32000, 'RON'),
    'an impossible month is refused');
SELECT public.test_assert(NOT public.valid_enrollment_price_snapshot(public.test_none_snapshot(201,100,701,4,20000) || '{"validMonth":"2026-11"}', 20000, 'RON'),
    'a package without expiry cannot carry a month');
SELECT public.test_assert(public.valid_enrollment_price_snapshot(public.test_none_snapshot(201,100,701,4,20000), 20000, 'RON'),
    'packages without expiry keep the 00149 snapshot');
SELECT public.test_assert(NOT has_table_privilege('authenticated', 'public.enrollment_monthly_packages', 'INSERT,UPDATE,DELETE')
    AND NOT has_table_privilege('anon', 'public.enrollment_monthly_packages', 'SELECT')
    AND has_table_privilege('authenticated', 'public.enrollment_monthly_packages', 'SELECT'), 'clients only read monthly packages');
SELECT public.test_assert(bool_and(NOT has_function_privilege('authenticated', f, 'EXECUTE') AND NOT has_function_privilege('anon', f, 'EXECUTE')),
    'balance helpers are internal')
    FROM unnest(ARRAY['public.course_session_debit(uuid,date)', 'public.course_session_credit(uuid,uuid)',
        'public.course_sessions_available(uuid,date)', 'public.course_session_shortage(uuid,date)']) f;

SELECT public.test_assert(public.course_quote_matches_offer(public.test_uuid(100),
    public.test_monthly_snapshot(201,100,700,8,32000,public.test_month(0))), 'the current month can be bought');
SELECT public.test_assert(public.course_quote_matches_offer(public.test_uuid(100),
    public.test_monthly_snapshot(201,100,700,8,32000,public.test_month(1))), 'the next month can be bought');
SELECT public.test_assert(NOT public.course_quote_matches_offer(public.test_uuid(100),
    public.test_monthly_snapshot(201,100,700,8,32000,public.test_month(-1))), 'a past month cannot be bought');
SELECT public.test_assert(NOT public.course_quote_matches_offer(public.test_uuid(100),
    public.test_monthly_snapshot(201,100,700,8,32000,public.test_month(2))), 'two months ahead cannot be bought');
SELECT public.test_assert(NOT public.course_quote_matches_offer(public.test_uuid(100),
    public.test_monthly_snapshot(201,100,701,4,20000,public.test_month(0))), 'a package without expiry cannot be sold as monthly');
SELECT public.test_assert(NOT public.course_quote_matches_offer(public.test_uuid(100),
    public.test_none_snapshot(201,100,700,8,32000)), 'a monthly package cannot be sold without expiry');
SELECT public.test_assert(public.course_quote_matches_offer(public.test_uuid(100),
    public.test_none_snapshot(201,100,701,4,20000)), 'packages without expiry still sell');

DO $$
DECLARE v_rows INTEGER;
BEGIN
    SELECT count(*) INTO v_rows FROM public.save_course_packages(public.test_uuid(101),
        '[{"sessions":8,"price":30000,"validity":"CALENDAR_MONTH"},{"sessions":8,"price":40000,"validity":"NONE"}]');
    PERFORM public.test_assert(v_rows = 2, 'the coach can save a monthly package next to one without expiry');
    PERFORM public.test_assert((SELECT validity FROM public.course_packages WHERE course_id = public.test_uuid(101) AND position = 0)
        = 'CALENDAR_MONTH', 'the monthly validity is stored');
END $$;

SET LOCAL ROLE service_role;
DO $$
DECLARE v_result JSONB; v_payment UUID; v_month TEXT := public.test_month(1);
BEGIN
    v_result := public.start_course_renewal(public.test_uuid(2), public.test_uuid(1212), 'CASH',
        public.test_quote(public.test_monthly_snapshot(212,100,700,8,32000,v_month)), NULL, public.test_acceptance());
    v_payment := (v_result->>'paymentId')::UUID;
    PERFORM public.test_assert(NOT EXISTS (SELECT 1 FROM public.enrollment_monthly_packages WHERE payment_id = v_payment),
        'a cash monthly package waits for the coach and gives no session yet');
    v_result := public.apply_enrollment_payment_result(v_payment, 'SUCCEEDED', 32000, 'RON', 'CASH', NULL);
    PERFORM public.test_assert((v_result->>'sessionsAdded')::INTEGER = 8, 'confirmation reports the package sessions');
    PERFORM public.test_assert((SELECT valid_from = to_date(v_month || '-01', 'YYYY-MM-DD')
            AND valid_until = (to_date(v_month || '-01', 'YYYY-MM-DD') + INTERVAL '1 month' - INTERVAL '1 day')::DATE
            AND sessions = 8 AND sessions_used = 0 AND package_id = public.test_uuid(700)
        FROM public.enrollment_monthly_packages WHERE payment_id = v_payment),
        'the confirmed package is valid for the whole month the parent chose, not the confirmation month');
    PERFORM public.test_assert(public.test_pool(1212) = '0/0' AND (SELECT purchased_sessions FROM public.enrollments
        WHERE id = public.test_uuid(1212)) = 0, 'a monthly package does not touch the never-expiring balance');
    v_result := public.apply_enrollment_payment_result(v_payment, 'SUCCEEDED', 32000, 'RON', 'CASH', NULL);
    PERFORM public.test_assert((SELECT count(*) FROM public.enrollment_monthly_packages WHERE payment_id = v_payment) = 1,
        'confirming twice creates the package once');

    v_result := public.start_course_renewal(public.test_uuid(2), public.test_uuid(1213), 'CASH',
        public.test_quote(public.test_none_snapshot(213,100,701,4,20000)), NULL, public.test_acceptance());
    PERFORM public.apply_enrollment_payment_result((v_result->>'paymentId')::UUID, 'SUCCEEDED', 20000, 'RON', 'CASH', NULL);
    PERFORM public.test_assert(public.test_pool(1213) = '4/0'
        AND NOT EXISTS (SELECT 1 FROM public.enrollment_monthly_packages WHERE enrollment_id = public.test_uuid(1213)),
        'a package without expiry adds to the balance exactly as before');

    PERFORM public.test_assert(public.test_try(format('SELECT public.start_course_renewal(%L, %L, ''CASH'', %L, NULL, %L)',
        public.test_uuid(2), public.test_uuid(1214),
        public.test_quote(public.test_monthly_snapshot(214,100,700,8,32000,public.test_month(-1))), public.test_acceptance()))
        = '23514:PRICE_CHANGED', 'a renewal for a past month is refused');
END $$;
RESET ROLE;

SELECT public.test_add_package(801, 1201, 2, '2026-01-01');
SELECT public.test_assert((public.test_mark(1, 201, 'PRESENT', 901)->>'success')::BOOLEAN
    AND public.test_used(801) = 1 AND public.test_pool(1201) = '2/0',
    'coach manual: the monthly package is used before the sessions that never expire');
SELECT public.test_assert((public.test_mark(2, 201, 'ABSENT', 901)->>'success')::BOOLEAN
    AND public.test_used(801) = 0 AND public.test_pool(1201) = '2/0',
    'changing to absent gives the session back to the same monthly package');
SELECT public.test_assert(public.test_mark(3, 201, 'PRESENT', 901)->>'success' = 'true'
    AND public.test_mark(4, 201, 'PRESENT', 904)->>'success' = 'true'
    AND public.test_mark(5, 201, 'PRESENT', 905)->>'success' = 'true'
    AND public.test_used(801) = 2 AND public.test_pool(1201) = '1/1',
    'when the monthly package is used up, the never-expiring sessions are used next');
SELECT public.test_assert((public.test_mark(6, 201, NULL, 905)->>'success')::BOOLEAN
    AND public.test_used(801) = 2 AND public.test_pool(1201) = '2/0',
    'clearing a mark gives the session back to the balance it came from');

SELECT public.test_add_package(802, 1202, 1, '2026-01-01', 0, now() - INTERVAL '1 day');
SELECT public.test_add_package(803, 1202, 1, '2026-01-01', 0, now());
SELECT public.test_add_package(804, 1202, 3, '2026-02-01');
SELECT public.test_assert(public.test_mark(10, 202, 'PRESENT', 901)->>'success' = 'true'
    AND public.test_used(802) = 1 AND public.test_used(803) = 0 AND public.test_used(804) = 0,
    'with two packages for the same month the older one is used first; next month''s package is not touched');
SELECT public.test_assert(public.test_mark(11, 202, 'PRESENT', 904)->>'success' = 'true'
    AND public.test_used(803) = 1 AND public.test_used(804) = 0, 'then the second package of the month');
SELECT public.test_assert(public.test_mark(12, 202, 'PRESENT', 905)->>'code' = 'NO_REMAINING_SESSIONS'
    AND public.test_used(804) = 0, 'a used-up month does not borrow from the next month''s package');
SELECT public.test_assert(public.test_mark(13, 202, 'PRESENT', 903)->>'success' = 'true' AND public.test_used(804) = 1,
    'a session at 00:30 on 1 February (Bucharest) uses the February package');

SELECT public.test_add_package(805, 1203, 4, '2026-01-01');
SELECT public.test_assert(public.test_mark(20, 203, 'PRESENT', 902)->>'success' = 'true' AND public.test_used(805) = 1,
    'a session at 23:30 on 31 January (Bucharest) still uses the January package');
SELECT public.test_assert(public.test_mark(21, 203, 'PRESENT', 903)->>'code' = 'PACKAGE_EXPIRED' AND public.test_used(805) = 1,
    'after midnight in Bucharest the January package has expired and the mark is refused');
SELECT public.test_assert(NOT EXISTS (SELECT 1 FROM public.attendance WHERE occurrence_id = public.test_uuid(903)
    AND child_id = public.test_uuid(203)), 'a refused mark writes no attendance');

SELECT public.test_add_package(806, 1204, 4, '2026-02-01');
SELECT public.test_assert(public.test_mark(30, 204, 'PRESENT', 902)->>'code' = 'PACKAGE_NOT_STARTED' AND public.test_used(806) = 0,
    'a package for next month cannot be used before the month starts');
SELECT public.test_assert(public.test_mark(31, 205, 'PRESENT', 901)->>'code' = 'NO_REMAINING_SESSIONS',
    'without any package or session the mark is refused as before');
SELECT public.test_assert(public.test_mark(32, 206, 'PRESENT', 901)->>'success' = 'true' AND public.test_pool(1206) = '1/1',
    'an enrollment without monthly packages keeps the old balance rules');

SELECT public.test_add_package(807, 1207, 2, '2026-01-01');
SELECT public.test_assert(public.test_mark(40, 207, 'PRESENT', 901, 3)->>'success' = 'true' AND public.test_used(807) = 1,
    'club manual: the club uses the monthly package too');
SELECT public.test_add_package(808, 1208, 1, '2026-02-01');
SELECT public.test_assert(public.test_mark(41, 208, 'PRESENT', 902, 3)->>'code' = 'PACKAGE_NOT_STARTED',
    'club manual: the club sees why the mark is refused');

SELECT public.test_add_package(809, 1209, 1, '2026-01-01');
SELECT public.test_assert(public.test_scan(50, 209, 901)->>'success' = 'true' AND public.test_used(809) = 1,
    'scan: the coach scanning the child''s code uses the monthly package');
SELECT public.test_assert(public.test_scan(51, 209, 903)->>'code' = 'PACKAGE_EXPIRED', 'scan: an expired package is refused');

SELECT public.test_add_package(810, 1210, 1, '2026-01-01');
SELECT public.test_add_package(811, 1211, 2, '2026-01-01');
SELECT public.test_assert(public.test_bulk(60, ARRAY[210, 211], 904)->>'success' = 'true'
    AND public.test_used(810) = 1 AND public.test_used(811) = 1, '„Toți prezenți” uses each child''s monthly package');

SELECT public.test_add_package(812, 1214, 2, date_trunc('month', public.bucharest_date(now()))::DATE);
SELECT public.test_add_package(813, 1215, 2, (date_trunc('month', public.bucharest_date(now())) + INTERVAL '1 month')::DATE);
SELECT set_config('request.jwt.claim.sub', public.test_uuid(1)::TEXT, true);
SELECT public.get_coach_entrance_code(NULL);
SELECT set_config('request.jwt.claim.sub', public.test_uuid(2)::TEXT, true);
DO $$
DECLARE v_options JSONB; v_option JSONB; v_result JSONB;
BEGIN
    v_options := public.entrance_checkin_options(public.test_token(1));
    SELECT o INTO v_option FROM jsonb_array_elements(v_options->'options') o
        WHERE o->>'childId' = public.test_uuid(214)::TEXT;
    PERFORM public.test_assert(v_option->>'state' = 'AVAILABLE' AND (v_option->>'remainingSessions')::INTEGER = 2,
        'entrance: the parent sees the sessions left in this month''s package');
    SELECT o INTO v_option FROM jsonb_array_elements(v_options->'options') o
        WHERE o->>'childId' = public.test_uuid(215)::TEXT;
    PERFORM public.test_assert(v_option->>'state' = 'PACKAGE_NOT_STARTED' AND (v_option->>'remainingSessions')::INTEGER = 0,
        'entrance: a package bought for next month is shown as not started');
    v_result := public.entrance_checkin(public.test_token(1), public.test_uuid(906), public.test_uuid(214), public.test_uuid(40001));
    PERFORM public.test_assert(v_result->>'outcome' = 'recorded' AND (v_result->>'remainingSessions')::INTEGER = 1
        AND public.test_used(812) = 1, 'entrance: the check-in uses this month''s package and shows what is left');
    PERFORM public.test_assert((SELECT debit_monthly_package_id = public.test_uuid(812) FROM public.attendance_accounting
        WHERE occurrence_id = public.test_uuid(906) AND child_id = public.test_uuid(214)), 'entrance: the debit remembers the package');
    v_result := public.entrance_checkin(public.test_token(1), public.test_uuid(906), public.test_uuid(215), public.test_uuid(40002));
    PERFORM public.test_assert(v_result->>'code' = 'PACKAGE_NOT_STARTED' AND public.test_used(813) = 0,
        'entrance: next month''s package cannot be used today');
END $$;
SELECT public.test_assert((public.test_mark(70, 214, 'ABSENT', 906)->>'success')::BOOLEAN AND public.test_used(812) = 0,
    'the coach correcting an entrance check-in gives the session back to the package');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', public.test_uuid(2)::TEXT, true);
SELECT public.test_assert((SELECT count(*) FROM public.enrollment_monthly_packages) > 0
    AND NOT EXISTS (SELECT 1 FROM public.enrollment_monthly_packages WHERE enrollment_id = public.test_uuid(1301)),
    'a parent reads the packages of their own children');
SELECT set_config('request.jwt.claim.sub', public.test_uuid(4)::TEXT, true);
SELECT public.test_assert(NOT EXISTS (SELECT 1 FROM public.enrollment_monthly_packages WHERE enrollment_id = public.test_uuid(1201)),
    'another parent cannot read them');
RESET ROLE;

SELECT public.test_assert(public.test_try('UPDATE public.enrollment_monthly_packages SET sessions_used = sessions + 1 WHERE id = '
    || quote_literal(public.test_uuid(801))) LIKE '23514%', 'a package cannot use more sessions than it has');
SELECT public.test_assert(public.test_try('DELETE FROM public.enrollment_monthly_packages WHERE id = '
    || quote_literal(public.test_uuid(802))) LIKE '23503%', 'a package with attendance cannot be deleted');

ROLLBACK;
\echo 'course-monthly-packages: all assertions passed'
