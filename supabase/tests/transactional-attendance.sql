\set ON_ERROR_STOP on
CREATE SCHEMA IF NOT EXISTS auth;
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY);
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('COACH', 'ADMIN', 'PARENT', 'CLUB')),
    enabled BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE public.courses (
    id UUID PRIMARY KEY, coach_id UUID NOT NULL REFERENCES public.profiles(id)
);
CREATE TABLE public.course_occurrences (
    id UUID PRIMARY KEY, course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(), ends_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.children (
    id UUID PRIMARY KEY, parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL, qr_token TEXT NOT NULL UNIQUE
);
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL CHECK (kind IN ('COURSE', 'CAMP', 'ACTIVITY')),
    entity_id UUID NOT NULL, child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PENDING', 'CANCELLED')),
    remaining_sessions INTEGER NOT NULL DEFAULT 0, sessions_used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id UUID NOT NULL REFERENCES public.course_occurrences(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT')),
    UNIQUE (occurrence_id, child_id)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.attendance TO authenticated, service_role;
CREATE POLICY attendance_select ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY attendance_insert ON public.attendance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY attendance_update ON public.attendance FOR UPDATE TO authenticated USING (true);
CREATE POLICY attendance_delete ON public.attendance FOR DELETE TO authenticated USING (true);

\i /tmp/transactional-attendance-migration.sql

CREATE FUNCTION public.test_uuid(n INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-0000-0000-' || lpad(n::TEXT, 12, '0'))::UUID
$$;
CREATE FUNCTION public.test_assert(value BOOLEAN, label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', label; END IF; END
$$;
CREATE FUNCTION public.test_record(req INTEGER, child INTEGER, status TEXT, qr BOOLEAN DEFAULT false,
    occurrence INTEGER DEFAULT 101, actor INTEGER DEFAULT 1) RETURNS JSONB LANGUAGE sql AS $$
    SELECT public.record_attendance_transaction(public.test_uuid(actor),
        jsonb_build_object('requestId', public.test_uuid(10000 + req), 'occurrenceId', public.test_uuid(occurrence), 'status', status) ||
        CASE WHEN qr THEN jsonb_build_object('qrToken', md5(public.test_uuid(child)::TEXT))
        ELSE jsonb_build_object('childId', public.test_uuid(child)) END)
$$;
CREATE FUNCTION public.test_bulk(req INTEGER, children INTEGER[]) RETURNS JSONB LANGUAGE sql AS $$
    SELECT public.record_attendance_transaction(public.test_uuid(1), jsonb_build_object(
        'requestId', public.test_uuid(10000 + req), 'occurrenceId', public.test_uuid(101),
        'childIds', (SELECT jsonb_agg(public.test_uuid(n)) FROM unnest(children) n),
        'status', 'PRESENT', 'onlyUnmarked', true))
$$;

INSERT INTO auth.users (id) SELECT public.test_uuid(n) FROM generate_series(1, 5) n;
INSERT INTO public.profiles VALUES (public.test_uuid(1), 'COACH', true), (public.test_uuid(2), 'PARENT', true),
    (public.test_uuid(3), 'COACH', true), (public.test_uuid(4), 'ADMIN', true), (public.test_uuid(5), 'COACH', false);
INSERT INTO public.courses VALUES (public.test_uuid(11), public.test_uuid(1)), (public.test_uuid(12), public.test_uuid(3));
INSERT INTO public.course_occurrences (id, course_id) VALUES
    (public.test_uuid(101), public.test_uuid(11)), (public.test_uuid(102), public.test_uuid(11)),
    (public.test_uuid(103), public.test_uuid(12));
INSERT INTO public.children SELECT public.test_uuid(n), public.test_uuid(2), 'Child ' || n, md5(public.test_uuid(n)::TEXT)
    FROM generate_series(201, 230) n;
INSERT INTO public.enrollments (id, kind, entity_id, child_id, status, remaining_sessions)
    SELECT public.test_uuid(n + 1000), 'COURSE', public.test_uuid(11), public.test_uuid(n), 'ACTIVE', 3
    FROM generate_series(201, 230) n;

SELECT public.test_assert(NOT has_function_privilege('authenticated', 'public.record_attendance_transaction(uuid,jsonb)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.record_attendance_transaction(uuid,jsonb)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.record_attendance_transaction(uuid,jsonb)', 'EXECUTE'), 'RPC is service-role only');
SELECT public.test_assert(NOT has_table_privilege('authenticated', 'public.attendance', 'INSERT,UPDATE,DELETE')
    AND has_table_privilege('authenticated', 'public.attendance', 'SELECT'), 'direct attendance writes revoked, reads preserved');
SELECT public.test_assert(NOT has_table_privilege('authenticated', 'public.attendance_operations', 'SELECT')
    AND NOT has_table_privilege('authenticated', 'public.attendance_accounting', 'SELECT'), 'receipts and balances private');
SELECT public.test_assert((SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN (
    'public.attendance_operations'::regclass, 'public.attendance_accounting'::regclass)), 'new tables have RLS');
SET ROLE authenticated;
DO $$ BEGIN
    BEGIN
        PERFORM public.record_attendance_transaction(public.test_uuid(1), '{}'::JSONB);
        RAISE EXCEPTION 'authenticated RPC unexpectedly allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
        INSERT INTO public.attendance (occurrence_id, child_id, status)
            VALUES (public.test_uuid(101), public.test_uuid(201), 'PRESENT');
        RAISE EXCEPTION 'authenticated insert unexpectedly allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

SELECT public.test_assert(public.test_record(1, 201, 'PRESENT', true)->>'outcome' = 'recorded', 'first QR records');
SELECT public.test_assert((SELECT remaining_sessions = 2 AND sessions_used = 1 FROM public.enrollments WHERE id = public.test_uuid(1201)), 'QR debits once');
SELECT public.test_assert(public.test_record(1, 201, 'PRESENT', true)->>'outcome' = 'recorded', 'lost-response retry returns original receipt');
SELECT public.test_assert(public.test_record(2, 201, 'PRESENT', true)->>'outcome' = 'duplicate', 'new request duplicate QR');
SELECT public.test_assert(public.test_record(1, 202, 'PRESENT', true)->>'code' = 'REQUEST_CONFLICT', 'request ID payload binding');
UPDATE public.courses SET coach_id = public.test_uuid(3) WHERE id = public.test_uuid(11);
SELECT public.test_assert(public.test_record(1, 201, 'PRESENT', true)->>'code' = 'FORBIDDEN', 'receipt replay requires current course ownership');
UPDATE public.courses SET coach_id = public.test_uuid(1) WHERE id = public.test_uuid(11);
SELECT public.test_assert((SELECT remaining_sessions = 2 AND sessions_used = 1 FROM public.enrollments WHERE id = public.test_uuid(1201)), 'retries never debit');
SELECT public.test_assert(public.test_record(3, 201, 'ABSENT')->>'outcome' = 'recorded', 'manual correction');
SELECT public.test_assert((SELECT remaining_sessions = 3 AND sessions_used = 0 FROM public.enrollments WHERE id = public.test_uuid(1201)), 'refund recorded debit');
SELECT public.test_assert(public.test_record(4, 201, 'PRESENT', true)->>'outcome' = 'duplicate', 'QR receipt survives manual correction');
SELECT public.test_assert((SELECT status = 'ABSENT' FROM public.attendance WHERE child_id = public.test_uuid(201)), 'duplicate preserves manual absent');
SELECT public.test_record(5, 201, null);
SELECT public.test_assert(public.test_record(6, 201, 'PRESENT', true)->>'outcome' = 'duplicate', 'QR receipt survives clear');
SELECT public.test_assert(NOT EXISTS (SELECT FROM public.attendance WHERE child_id = public.test_uuid(201)), 'duplicate cannot recreate cleared row');
SELECT public.test_record(7, 201, 'PRESENT');
SELECT public.test_record(8, 201, null);
SELECT public.test_assert((SELECT remaining_sessions = 3 AND sessions_used = 0 FROM public.enrollments WHERE id = public.test_uuid(1201)), 'manual re-present and clear symmetric');

SELECT public.test_record(10, 202, 'ABSENT');
SELECT public.test_assert(public.test_record(11, 202, 'PRESENT', true)->>'code' = 'MANUAL_OVERRIDE', 'first delayed QR cannot overwrite manual absent');
SELECT public.test_record(12, 203, null);
SELECT public.test_assert(public.test_record(13, 203, 'PRESENT', true)->>'code' = 'MANUAL_OVERRIDE', 'first delayed QR cannot overwrite manual clear');
INSERT INTO public.attendance (occurrence_id, child_id, status) VALUES
    (public.test_uuid(101), public.test_uuid(204), 'PRESENT'), (public.test_uuid(101), public.test_uuid(205), 'ABSENT');
SELECT public.test_assert(public.test_record(14, 204, 'PRESENT', true)->>'outcome' = 'duplicate', 'historical present QR no debit');
SELECT public.test_record(15, 204, null);
SELECT public.test_assert((SELECT remaining_sessions = 3 AND sessions_used = 0 FROM public.enrollments WHERE id = public.test_uuid(1204)), 'historical present clear creates no refund');
SELECT public.test_assert(public.test_record(16, 205, 'PRESENT', true)->>'code' = 'MANUAL_OVERRIDE', 'historical absent cannot be overwritten');

SELECT public.test_assert(public.test_record(20, 206, 'PRESENT', true, 101, 2)->>'code' = 'FORBIDDEN', 'parent forbidden');
SELECT public.test_assert(public.test_record(21, 206, 'PRESENT', true, 101, 3)->>'code' = 'FORBIDDEN', 'foreign coach forbidden');
SELECT public.test_assert(public.test_record(22, 206, 'PRESENT', true, 101, 5)->>'code' = 'FORBIDDEN', 'disabled actor forbidden');
SELECT public.test_assert(public.test_record(23, 206, 'PRESENT', true, 999)->>'code' = 'OCCURRENCE_NOT_FOUND', 'unknown occurrence');
SELECT public.test_assert(public.test_record(24, 999, 'PRESENT', true)->>'code' = 'INVALID_QR', 'unknown QR');
UPDATE public.children SET qr_token = repeat('f', 32) WHERE id = public.test_uuid(206);
SELECT public.test_assert(public.test_record(25, 206, 'PRESENT', true)->>'code' = 'INVALID_QR', 'rotated token rejected');
UPDATE public.enrollments SET status = 'CANCELLED' WHERE id = public.test_uuid(1207);
SELECT public.test_assert(public.test_record(26, 207, 'PRESENT', true)->>'code' = 'NOT_ENROLLED', 'cancelled enrollment rejected');
INSERT INTO public.enrollments (kind, entity_id, child_id, status, remaining_sessions)
    VALUES ('COURSE', public.test_uuid(11), public.test_uuid(208), 'ACTIVE', 3);
SELECT public.test_assert(public.test_record(27, 208, 'PRESENT', true)->>'code' = 'AMBIGUOUS_ENROLLMENT', 'ambiguous active enrollment rejected');
UPDATE public.enrollments SET remaining_sessions = 0 WHERE id = public.test_uuid(1209);
SELECT public.test_assert(public.test_record(28, 209, 'PRESENT', true)->>'code' = 'NO_REMAINING_SESSIONS', 'zero sessions rejected');
SELECT public.test_assert(public.test_record(29, 210, 'PRESENT', false, 101, 4)->>'outcome' = 'recorded', 'admin may record');

SELECT public.test_record(30, 211, 'ABSENT');
SELECT public.test_assert(public.test_bulk(31, ARRAY[211,212])->>'outcome' = 'recorded', 'bulk fills only unmarked');
SELECT public.test_assert((SELECT status = 'ABSENT' FROM public.attendance WHERE child_id = public.test_uuid(211)), 'bulk preserves absent');
SELECT public.test_assert((SELECT remaining_sessions = 3 FROM public.enrollments WHERE id = public.test_uuid(1211)), 'bulk skipped child not debited');
SELECT public.test_assert(public.test_bulk(32, ARRAY[211,212])->>'outcome' = 'duplicate', 'all-marked bulk duplicate');
UPDATE public.enrollments SET remaining_sessions = 0 WHERE id = public.test_uuid(1214);
SELECT public.test_assert(public.test_bulk(33, ARRAY[213,214])->>'code' = 'NO_REMAINING_SESSIONS', 'bulk error reported');
SELECT public.test_assert(NOT EXISTS (SELECT FROM public.attendance WHERE child_id = public.test_uuid(213))
    AND NOT EXISTS (SELECT FROM public.attendance_accounting WHERE child_id = public.test_uuid(213))
    AND (SELECT remaining_sessions = 3 FROM public.enrollments WHERE id = public.test_uuid(1213)), 'bulk rollback is all-or-none');
SELECT public.test_assert(NOT EXISTS (SELECT FROM public.attendance_operations WHERE request_id = public.test_uuid(10033)), 'failed bulk has no success receipt');

SELECT public.test_record(40, 215, 'PRESENT');
UPDATE public.enrollments SET status = 'CANCELLED' WHERE id = public.test_uuid(1215);
INSERT INTO public.enrollments (id, kind, entity_id, child_id, status, remaining_sessions)
    VALUES (public.test_uuid(2215), 'COURSE', public.test_uuid(11), public.test_uuid(215), 'ACTIVE', 9);
SELECT public.test_record(41, 215, null);
SELECT public.test_assert((SELECT remaining_sessions = 3 AND sessions_used = 0 FROM public.enrollments WHERE id = public.test_uuid(1215))
    AND (SELECT remaining_sessions = 9 AND sessions_used = 0 FROM public.enrollments WHERE id = public.test_uuid(2215)), 'refund targets original enrollment');
SELECT public.test_assert(public.test_record(42, 216, 'WRONG')->>'code' = 'INVALID_REQUEST', 'invalid status rejected');
SELECT public.test_assert(public.record_attendance_transaction(public.test_uuid(1), '{}'::JSONB)->>'code' = 'INVALID_REQUEST', 'missing fields rejected');
SELECT public.test_record(43, 217, 'PRESENT');
DELETE FROM public.children WHERE id = public.test_uuid(217);
SELECT public.test_assert(NOT EXISTS (SELECT FROM public.enrollments WHERE child_id = public.test_uuid(217))
    AND NOT EXISTS (SELECT FROM public.attendance WHERE child_id = public.test_uuid(217))
    AND NOT EXISTS (SELECT FROM public.attendance_accounting WHERE child_id = public.test_uuid(217)), 'child deletion cascades with an active attendance debit');
INSERT INTO auth.users (id) VALUES (public.test_uuid(6));
INSERT INTO public.profiles VALUES (public.test_uuid(6), 'PARENT', true);
INSERT INTO public.children VALUES (public.test_uuid(231), public.test_uuid(6), 'Deleted account child', md5(public.test_uuid(231)::TEXT));
INSERT INTO public.enrollments (id, kind, entity_id, child_id, status, remaining_sessions)
    VALUES (public.test_uuid(1231), 'COURSE', public.test_uuid(11), public.test_uuid(231), 'ACTIVE', 3);
SELECT public.test_record(44, 231, 'PRESENT');
DELETE FROM auth.users WHERE id = public.test_uuid(6);
SELECT public.test_assert(NOT EXISTS (SELECT FROM public.children WHERE id = public.test_uuid(231))
    AND NOT EXISTS (SELECT FROM public.enrollments WHERE child_id = public.test_uuid(231))
    AND NOT EXISTS (SELECT FROM public.attendance WHERE child_id = public.test_uuid(231))
    AND NOT EXISTS (SELECT FROM public.attendance_accounting WHERE child_id = public.test_uuid(231)), 'account deletion cascades with an active attendance debit');
SELECT 'Transactional attendance assertions passed' AS result;
