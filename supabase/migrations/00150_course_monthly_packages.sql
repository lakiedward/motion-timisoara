-- Feature TT #698: monthly course packages („pachet lunar”). The coach or club
-- marks a package CALENDAR_MONTH; the parent picks the current or the next
-- month (Europe/Bucharest), pays the full price, and the sessions are valid from
-- the 1st to the last day of that month. Unused sessions are lost.
--
-- Balances:
--   * enrollments.purchased_sessions / remaining_sessions / sessions_used keep
--     their meaning and now hold only sessions that never expire (per-session
--     purchases and NONE packages), exactly as before this migration.
--   * every confirmed monthly package is one enrollment_monthly_packages row
--     (one payment = one package) with its own sessions / sessions_used and its
--     calendar month [valid_from, valid_until].
--   * a "Prezent" takes one session from the package valid on the session's
--     Bucharest date that expires first (monthly before the never-expiring
--     pool); attendance_accounting remembers which one, so undoing it gives the
--     session back to the same package. Without a usable session the mark is
--     refused: NO_REMAINING_SESSIONS, PACKAGE_EXPIRED or PACKAGE_NOT_STARTED.
--   * cash: the package exists only after the coach or club confirms the cash
--     payment (apply_enrollment_payment_result); the month chosen at checkout is
--     kept in the accepted price snapshot and does not change.
--
-- Replaced functions are checked against their live md5 first: 00144
-- record_attendance_transaction, 00142 entrance_checkin(_options), 00068
-- apply_enrollment_payment_result, 00148 save_course_packages, 00149
-- valid_course_package_price_snapshot and course_quote_matches_offer.

DO $guard$
DECLARE
    v_expected CONSTANT JSONB := jsonb_build_object(
        'record_attendance_transaction', '013184e07a7ae6ff032a191f3f19a0e3',
        'entrance_checkin', '17f742729a65c59be145f37e9ecc2a17',
        'entrance_checkin_options', 'ae86b99a987605b2351f1ede9baa0156',
        'apply_enrollment_payment_result', '4eadad02e6f7006fc1bc8b9ef551b74e',
        'save_course_packages', 'e12b34e733445a45bcd3529d52af1369',
        'valid_course_package_price_snapshot', '7f49fdd55954c7818734fa6417833eee',
        'course_quote_matches_offer', 'd2150a21cecc2b9d746f922cf82f3b8c');
    v_name TEXT;
    v_md5 TEXT;
BEGIN
    FOR v_name IN SELECT jsonb_object_keys(v_expected) LOOP
        SELECT md5(p.prosrc) INTO v_md5 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = v_name;
        IF v_md5 IS DISTINCT FROM v_expected->>v_name THEN
            RAISE EXCEPTION '% differs from the reviewed source (md5 %); stop and compare', v_name, v_md5;
        END IF;
    END LOOP;
END
$guard$;

CREATE TABLE public.enrollment_monthly_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE RESTRICT,
    package_id UUID REFERENCES public.course_packages(id) ON DELETE SET NULL,
    sessions INTEGER NOT NULL CHECK (sessions BETWEEN 1 AND 100),
    sessions_used INTEGER NOT NULL DEFAULT 0,
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT enrollment_monthly_packages_used_check CHECK (sessions_used BETWEEN 0 AND sessions),
    CONSTRAINT enrollment_monthly_packages_month_check CHECK (
        valid_from = date_trunc('month', valid_from)::DATE
        AND valid_until = (valid_from + INTERVAL '1 month' - INTERVAL '1 day')::DATE)
);

CREATE INDEX enrollment_monthly_packages_enrollment_idx
    ON public.enrollment_monthly_packages (enrollment_id, valid_until);

ALTER TABLE public.enrollment_monthly_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY enrollment_monthly_packages_select ON public.enrollment_monthly_packages
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = enrollment_monthly_packages.enrollment_id));

REVOKE ALL ON public.enrollment_monthly_packages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.enrollment_monthly_packages TO authenticated;
GRANT ALL ON public.enrollment_monthly_packages TO service_role;

ALTER TABLE public.attendance_accounting
    ADD COLUMN debit_monthly_package_id UUID
        REFERENCES public.enrollment_monthly_packages(id) ON DELETE RESTRICT;

CREATE FUNCTION public.bucharest_date(p_at TIMESTAMPTZ)
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT (p_at AT TIME ZONE 'Europe/Bucharest')::DATE
$$;

CREATE FUNCTION public.course_sessions_available(p_enrollment_id UUID, p_session_date DATE)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE((SELECT greatest(e.remaining_sessions, 0) FROM public.enrollments e
            WHERE e.id = p_enrollment_id), 0)
        + COALESCE((SELECT sum(m.sessions - m.sessions_used)::INTEGER FROM public.enrollment_monthly_packages m
            WHERE m.enrollment_id = p_enrollment_id
              AND p_session_date BETWEEN m.valid_from AND m.valid_until), 0)
$$;

CREATE FUNCTION public.course_session_shortage(p_enrollment_id UUID, p_session_date DATE)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT CASE
        WHEN public.course_sessions_available(p_enrollment_id, p_session_date) > 0 THEN NULL
        WHEN EXISTS (SELECT 1 FROM public.enrollment_monthly_packages m
            WHERE m.enrollment_id = p_enrollment_id
              AND p_session_date BETWEEN m.valid_from AND m.valid_until) THEN 'NO_REMAINING_SESSIONS'
        WHEN EXISTS (SELECT 1 FROM public.enrollment_monthly_packages m
            WHERE m.enrollment_id = p_enrollment_id AND m.valid_from > p_session_date) THEN 'PACKAGE_NOT_STARTED'
        WHEN EXISTS (SELECT 1 FROM public.enrollment_monthly_packages m
            WHERE m.enrollment_id = p_enrollment_id AND m.valid_until < p_session_date) THEN 'PACKAGE_EXPIRED'
        ELSE 'NO_REMAINING_SESSIONS'
    END
$$;

CREATE FUNCTION public.course_session_debit(p_enrollment_id UUID, p_session_date DATE)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SET search_path = ''
AS $$
DECLARE
    v_package UUID;
BEGIN
    IF p_enrollment_id IS NULL OR p_session_date IS NULL THEN
        RAISE EXCEPTION 'INVALID_REQUEST';
    END IF;
    SELECT m.id INTO v_package FROM public.enrollment_monthly_packages m
        WHERE m.enrollment_id = p_enrollment_id
          AND p_session_date BETWEEN m.valid_from AND m.valid_until
          AND m.sessions_used < m.sessions
        ORDER BY m.valid_until, m.created_at, m.id
        LIMIT 1
        FOR UPDATE;
    IF FOUND THEN
        UPDATE public.enrollment_monthly_packages SET sessions_used = sessions_used + 1 WHERE id = v_package;
        RETURN v_package;
    END IF;
    UPDATE public.enrollments SET remaining_sessions = remaining_sessions - 1,
        sessions_used = sessions_used + 1
        WHERE id = p_enrollment_id AND remaining_sessions > 0;
    IF FOUND THEN
        RETURN NULL;
    END IF;
    RAISE EXCEPTION '%', COALESCE(public.course_session_shortage(p_enrollment_id, p_session_date),
        'NO_REMAINING_SESSIONS');
END;
$$;

CREATE FUNCTION public.course_session_credit(p_enrollment_id UUID, p_monthly_package_id UUID)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SET search_path = ''
AS $$
BEGIN
    IF p_monthly_package_id IS NOT NULL THEN
        UPDATE public.enrollment_monthly_packages SET sessions_used = sessions_used - 1
            WHERE id = p_monthly_package_id AND enrollment_id = p_enrollment_id AND sessions_used > 0;
    ELSE
        UPDATE public.enrollments SET remaining_sessions = remaining_sessions + 1,
            sessions_used = sessions_used - 1
            WHERE id = p_enrollment_id AND sessions_used > 0;
    END IF;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_BALANCE';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.bucharest_date(TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bucharest_date(TIMESTAMPTZ) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.course_sessions_available(UUID, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.course_session_shortage(UUID, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.course_session_debit(UUID, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.course_session_credit(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.course_sessions_available(UUID, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.course_session_shortage(UUID, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.course_session_debit(UUID, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.course_session_credit(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.valid_course_package_price_snapshot(
    p_snapshot JSONB,
    p_amount BIGINT,
    p_currency TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
    v_price NUMERIC;
    v_quantity NUMERIC;
    v_rate NUMERIC;
    v_result NUMERIC;
    v_monthly BOOLEAN;
    v_keys INTEGER;
BEGIN
    v_monthly := p_snapshot->>'validity' IS NOT DISTINCT FROM 'CALENDAR_MONTH';
    v_keys := CASE WHEN v_monthly THEN 14 ELSE 13 END;
    IF jsonb_typeof(p_snapshot) IS DISTINCT FROM 'object'
        OR NOT p_snapshot ?& ARRAY['schemaVersion','kind','entityId','childId','packageId','validity',
            'sourcePackageAmount','sourceCurrency','quantity','eurRonRateMicros','amount','currency','priceVersion']
        OR (SELECT count(*) FROM jsonb_object_keys(p_snapshot)) <> v_keys
        OR p_snapshot->'schemaVersion' IS DISTINCT FROM '3'::JSONB
        OR p_snapshot->>'kind' IS DISTINCT FROM 'COURSE'
        OR (p_snapshot->>'validity' IN ('NONE','CALENDAR_MONTH')) IS DISTINCT FROM TRUE
        OR (v_monthly AND (p_snapshot->>'validMonth' ~ '^[0-9]{4}-(0[1-9]|1[0-2])$') IS DISTINCT FROM TRUE)
        OR (p_snapshot->>'sourceCurrency' IN ('RON','EUR')) IS DISTINCT FROM TRUE
        OR p_snapshot->>'currency' IS DISTINCT FROM 'RON' OR p_currency IS DISTINCT FROM 'RON'
        OR (p_snapshot->>'entityId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS DISTINCT FROM TRUE
        OR (p_snapshot->>'childId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS DISTINCT FROM TRUE
        OR (p_snapshot->>'packageId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS DISTINCT FROM TRUE
        OR (p_snapshot->>'priceVersion' ~ '^[0-9a-f]{64}$') IS DISTINCT FROM TRUE
        OR jsonb_typeof(p_snapshot->'sourcePackageAmount') IS DISTINCT FROM 'number'
        OR jsonb_typeof(p_snapshot->'quantity') IS DISTINCT FROM 'number'
        OR jsonb_typeof(p_snapshot->'amount') IS DISTINCT FROM 'number'
    THEN RETURN FALSE; END IF;
    v_price := (p_snapshot->>'sourcePackageAmount')::NUMERIC;
    v_quantity := (p_snapshot->>'quantity')::NUMERIC;
    IF v_price <> trunc(v_price) OR v_price NOT BETWEEN 1 AND 10000000
        OR v_quantity <> trunc(v_quantity) OR v_quantity NOT BETWEEN 1 AND 100
    THEN RETURN FALSE; END IF;
    IF p_snapshot->>'sourceCurrency' = 'EUR' THEN
        IF jsonb_typeof(p_snapshot->'eurRonRateMicros') IS DISTINCT FROM 'number' THEN RETURN FALSE; END IF;
        v_rate := (p_snapshot->>'eurRonRateMicros')::NUMERIC;
        IF v_rate <> trunc(v_rate) OR v_rate NOT BETWEEN 1 AND 9007199254740991 THEN RETURN FALSE; END IF;
        v_result := floor((v_price * v_rate + 500000) / 1000000);
    ELSE
        IF p_snapshot->'eurRonRateMicros' IS DISTINCT FROM 'null'::JSONB THEN RETURN FALSE; END IF;
        v_result := v_price;
    END IF;
    RETURN (v_result > 0 AND v_result <= 9007199254740991 AND v_result = p_amount
        AND v_result = (p_snapshot->>'amount')::NUMERIC) IS TRUE;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.course_quote_matches_offer(p_course_id UUID, p_snapshot JSONB)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT COALESCE((
        SELECT to_jsonb(c.currency) = p_snapshot->'sourceCurrency'
            AND coalesce(to_jsonb(c.eur_ron_rate_micros), 'null'::JSONB) = p_snapshot->'eurRonRateMicros'
            AND CASE
                WHEN EXISTS (SELECT 1 FROM public.course_packages p WHERE p.course_id = c.id) THEN
                    p_snapshot->'schemaVersion' = '3'::JSONB
                    AND EXISTS (
                        SELECT 1 FROM public.course_packages p
                        WHERE p.course_id = c.id
                          AND p.id::TEXT = p_snapshot->>'packageId'
                          AND p_snapshot->>'validity' = p.validity
                          AND to_jsonb(p.sessions) = p_snapshot->'quantity'
                          AND to_jsonb(p.price) = p_snapshot->'sourcePackageAmount'
                          AND CASE p.validity
                              WHEN 'NONE' THEN NOT p_snapshot ? 'validMonth'
                              WHEN 'CALENDAR_MONTH' THEN p_snapshot->>'validMonth' IN (
                                  to_char(public.bucharest_date(now()), 'YYYY-MM'),
                                  to_char(date_trunc('month', public.bucharest_date(now())) + INTERVAL '1 month', 'YYYY-MM'))
                              ELSE false
                          END)
                ELSE
                    p_snapshot->'schemaVersion' = '1'::JSONB
                    AND to_jsonb(c.price_per_session) = p_snapshot->'sourceUnitAmount'
            END
        FROM public.courses c
        WHERE c.id = p_course_id
    ), false)
$$;

CREATE OR REPLACE FUNCTION public.save_course_packages(p_course_id uuid, p_packages jsonb)
RETURNS SETOF public.course_packages
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM 1 FROM public.courses c WHERE c.id = p_course_id FOR NO KEY UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cursul nu există' USING ERRCODE = 'P0002';
    END IF;

    IF NOT COALESCE((SELECT public.pot_administra_curs(p_course_id)), false) THEN
        RAISE EXCEPTION 'Doar cursul propriu' USING ERRCODE = '42501';
    END IF;

    IF p_packages IS NULL OR jsonb_typeof(p_packages) <> 'array' THEN
        RAISE EXCEPTION 'Lista de pachete lipsește' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_packages) > 4 THEN
        RAISE EXCEPTION 'Cel mult 4 pachete' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        WITH i AS (SELECT NULLIF(e.value->>'id', '')::uuid AS id,
                   (e.ordinality - 1)::smallint AS position,
                   (e.value->>'sessions')::integer AS sessions,
                   (e.value->>'price')::bigint AS price,
                   COALESCE(NULLIF(e.value->>'validity', ''), 'NONE') AS validity
            FROM jsonb_array_elements(p_packages) WITH ORDINALITY AS e(value, ordinality))
        SELECT 1 FROM i
        WHERE i.id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.course_packages p
              WHERE p.id = i.id AND p.course_id = p_course_id
          )
    ) OR (
        WITH i AS (SELECT NULLIF(e.value->>'id', '')::uuid AS id,
                   (e.ordinality - 1)::smallint AS position,
                   (e.value->>'sessions')::integer AS sessions,
                   (e.value->>'price')::bigint AS price,
                   COALESCE(NULLIF(e.value->>'validity', ''), 'NONE') AS validity
            FROM jsonb_array_elements(p_packages) WITH ORDINALITY AS e(value, ordinality))
        SELECT count(*) <> count(DISTINCT i.id) FROM i WHERE i.id IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Pachet necunoscut pentru acest curs' USING ERRCODE = 'P0002';
    END IF;

    DELETE FROM public.course_packages p
    WHERE p.course_id = p_course_id
      AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(p_packages) AS e(value)
          WHERE NULLIF(e.value->>'id', '')::uuid = p.id
      );

    WITH i AS (SELECT NULLIF(e.value->>'id', '')::uuid AS id,
                   (e.ordinality - 1)::smallint AS position,
                   (e.value->>'sessions')::integer AS sessions,
                   (e.value->>'price')::bigint AS price,
                   COALESCE(NULLIF(e.value->>'validity', ''), 'NONE') AS validity
            FROM jsonb_array_elements(p_packages) WITH ORDINALITY AS e(value, ordinality))
    UPDATE public.course_packages p
       SET position = i.position,
           sessions = i.sessions,
           price = i.price,
           validity = i.validity,
           updated_at = now()
      FROM i
     WHERE p.id = i.id
       AND p.course_id = p_course_id
       AND (p.position, p.sessions, p.price, p.validity)
           IS DISTINCT FROM (i.position, i.sessions, i.price, i.validity);

    WITH i AS (SELECT NULLIF(e.value->>'id', '')::uuid AS id,
                   (e.ordinality - 1)::smallint AS position,
                   (e.value->>'sessions')::integer AS sessions,
                   (e.value->>'price')::bigint AS price,
                   COALESCE(NULLIF(e.value->>'validity', ''), 'NONE') AS validity
            FROM jsonb_array_elements(p_packages) WITH ORDINALITY AS e(value, ordinality))
    INSERT INTO public.course_packages (course_id, position, sessions, price, validity)
    SELECT p_course_id, i.position, i.sessions, i.price, i.validity
    FROM i
    WHERE i.id IS NULL;

    SET CONSTRAINTS public.course_packages_position_key, public.course_packages_offer_key IMMEDIATE;

    RETURN QUERY
        SELECT p.* FROM public.course_packages p
        WHERE p.course_id = p_course_id
        ORDER BY p.position;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_enrollment_payment_result(
    p_payment_id UUID,
    p_result TEXT,
    p_amount BIGINT,
    p_currency TEXT,
    p_method TEXT,
    p_gateway_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_enrollment_id UUID;
    v_enrollment public.enrollments;
    v_payment public.payments;
    v_sessions INTEGER := 0;
    v_monthly_sessions INTEGER := 0;
    v_month_start DATE;
    v_child_ok BOOLEAN;
    v_adult_ok BOOLEAN;
BEGIN
    IF p_result IS NULL OR p_result NOT IN ('SUCCEEDED', 'FAILED')
        OR p_method IS NULL OR p_method NOT IN ('CARD', 'CASH')
        OR (p_method = 'CASH' AND p_result <> 'SUCCEEDED') THEN
        RAISE EXCEPTION 'Invalid payment result' USING ERRCODE = '22023';
    END IF;

    SELECT enrollment_id INTO v_enrollment_id FROM public.payments WHERE id = p_payment_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'P0002'; END IF;
    SELECT * INTO v_enrollment FROM public.enrollments WHERE id = v_enrollment_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Enrollment not found' USING ERRCODE = 'P0002'; END IF;
    SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND OR v_payment.enrollment_id IS DISTINCT FROM v_enrollment_id THEN
        RAISE EXCEPTION 'Payment changed during confirmation' USING ERRCODE = '40001';
    END IF;

    IF v_payment.method IS DISTINCT FROM p_method
        OR p_amount IS NULL OR p_amount < 0 OR v_payment.amount IS DISTINCT FROM p_amount
        OR p_currency IS DISTINCT FROM 'RON' OR v_payment.currency IS DISTINCT FROM p_currency
        OR (p_method = 'CARD' AND (p_gateway_id IS NULL OR p_gateway_id = ''
            OR v_payment.gateway_txn_id IS DISTINCT FROM p_gateway_id))
        OR (p_method = 'CASH' AND (p_gateway_id IS NOT NULL OR v_payment.gateway_txn_id IS NOT NULL)) THEN
        RAISE EXCEPTION 'Payment does not match the accepted charge' USING ERRCODE = '23514';
    END IF;

    IF v_payment.status IN ('SUCCEEDED', 'REFUNDED', 'PARTIAL') THEN
        RETURN jsonb_build_object('changed', false, 'status', v_payment.status,
            'enrollmentId', v_enrollment.id, 'sessionsAdded', 0);
    END IF;
    IF v_payment.status NOT IN ('PENDING', 'FAILED') OR v_enrollment.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Payment is not awaiting confirmation' USING ERRCODE = '23514';
    END IF;

    IF p_result = 'FAILED' THEN
        UPDATE public.payments SET status = 'FAILED', updated_at = now() WHERE id = p_payment_id;
        RETURN jsonb_build_object('changed', v_payment.status <> 'FAILED', 'status', 'FAILED',
            'enrollmentId', v_enrollment.id, 'sessionsAdded', 0);
    END IF;

    IF public.valid_enrollment_price_snapshot(v_payment.pricing_snapshot, v_payment.amount, v_payment.currency) IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Invalid accepted price' USING ERRCODE = '23514';
    END IF;
    v_child_ok := v_enrollment.child_id IS NOT NULL
        AND v_payment.pricing_snapshot->>'childId' IS NOT DISTINCT FROM v_enrollment.child_id::TEXT;
    v_adult_ok := v_enrollment.adult_profile_id IS NOT NULL
        AND v_payment.pricing_snapshot->>'adultProfileId' IS NOT DISTINCT FROM v_enrollment.adult_profile_id::TEXT
        AND v_payment.pricing_snapshot->>'childId' IS NULL;
    IF v_payment.pricing_snapshot IS NOT NULL AND (
        v_payment.pricing_snapshot->>'kind' IS DISTINCT FROM v_enrollment.kind
        OR v_payment.pricing_snapshot->>'entityId' IS DISTINCT FROM v_enrollment.entity_id::TEXT
        OR (v_child_ok IS DISTINCT FROM true AND v_adult_ok IS DISTINCT FROM true)
    ) THEN
        RAISE EXCEPTION 'Accepted price does not match enrollment' USING ERRCODE = '23514';
    END IF;
    IF v_enrollment.kind = 'COURSE' THEN
        IF v_payment.pricing_snapshot IS NULL THEN
            RAISE EXCEPTION 'Legacy course payment requires verified session quantity' USING ERRCODE = '23514';
        END IF;
        v_sessions := (v_payment.pricing_snapshot->>'quantity')::INTEGER;
        IF v_payment.pricing_snapshot->>'validity' = 'CALENDAR_MONTH' THEN
            v_month_start := to_date(v_payment.pricing_snapshot->>'validMonth' || '-01', 'YYYY-MM-DD');
            INSERT INTO public.enrollment_monthly_packages (enrollment_id, payment_id, package_id, sessions,
                valid_from, valid_until)
            VALUES (v_enrollment.id, v_payment.id,
                (SELECT p.id FROM public.course_packages p
                    WHERE p.id::TEXT = v_payment.pricing_snapshot->>'packageId'),
                v_sessions, v_month_start, (v_month_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE);
            v_monthly_sessions := v_sessions;
            v_sessions := 0;
        END IF;
    END IF;

    UPDATE public.enrollments SET status = 'ACTIVE',
        purchased_sessions = purchased_sessions + v_sessions,
        remaining_sessions = remaining_sessions + v_sessions
    WHERE id = v_enrollment.id;
    UPDATE public.payments SET status = 'SUCCEEDED', paid_at = now(), updated_at = now()
    WHERE id = p_payment_id;
    RETURN jsonb_build_object('changed', true, 'status', 'SUCCEEDED',
        'enrollmentId', v_enrollment.id, 'sessionsAdded', v_sessions + v_monthly_sessions);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_attendance_transaction(p_actor_id UUID, p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_request UUID;
    v_occurrence UUID;
    v_course UUID;
    v_coach UUID;
    v_club_owner UUID;
    v_starts TIMESTAMPTZ;
    v_role TEXT;
    v_status TEXT;
    v_qr TEXT;
    v_bulk BOOLEAN;
    v_children UUID[];
    v_child UUID;
    v_name TEXT;
    v_previous TEXT;
    v_hash TEXT;
    v_receipt public.attendance_operations%ROWTYPE;
    v_accounting public.attendance_accounting%ROWTYPE;
    v_enrollment public.enrollments%ROWTYPE;
    v_enrollments UUID[];
    v_result JSONB;
    v_changed BOOLEAN := false;
BEGIN
    IF p_actor_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
        OR NOT (p_payload ? 'status') THEN
        RAISE EXCEPTION 'INVALID_REQUEST';
    END IF;
    v_request := (p_payload->>'requestId')::UUID;
    v_occurrence := (p_payload->>'occurrenceId')::UUID;
    v_status := p_payload->>'status';
    v_qr := p_payload->>'qrToken';
    v_bulk := p_payload ? 'childIds';
    IF v_request IS NULL OR v_occurrence IS NULL
        OR (v_status IS NOT NULL AND v_status NOT IN ('PRESENT', 'ABSENT'))
        OR (v_qr IS NOT NULL AND (v_qr !~ '^[0-9a-f]{32}$' OR v_status IS DISTINCT FROM 'PRESENT'))
        OR (v_bulk AND (v_status IS DISTINCT FROM 'PRESENT' OR p_payload->'onlyUnmarked' IS DISTINCT FROM 'true'::JSONB))
        OR ((p_payload ? 'childId')::INTEGER + (p_payload ? 'qrToken')::INTEGER + v_bulk::INTEGER <> 1) THEN
        RAISE EXCEPTION 'INVALID_REQUEST';
    END IF;
    SELECT role INTO v_role FROM public.profiles
        WHERE id = p_actor_id AND enabled FOR SHARE;
    IF v_role IS NULL OR v_role NOT IN ('COACH', 'CLUB', 'ADMIN') THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_actor_id::TEXT || ':' || v_request::TEXT, 0));
    v_hash := md5(p_payload::TEXT);
    SELECT o.course_id, c.coach_id, o.starts_at,
            (SELECT cl.owner_user_id FROM public.clubs cl
                WHERE cl.id = c.club_id AND cl.approved_at IS NOT NULL)
        INTO v_course, v_coach, v_starts, v_club_owner
        FROM public.course_occurrences o JOIN public.courses c ON c.id = o.course_id
        WHERE o.id = v_occurrence FOR SHARE OF o, c;
    IF NOT FOUND THEN
        RAISE EXCEPTION '%', CASE WHEN v_role = 'CLUB' THEN 'FORBIDDEN' ELSE 'OCCURRENCE_NOT_FOUND' END;
    END IF;
    IF v_role = 'COACH' AND v_coach <> p_actor_id THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;
    IF v_role = 'CLUB' AND (v_club_owner IS DISTINCT FROM p_actor_id OR v_qr IS NOT NULL) THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;
    SELECT * INTO v_receipt FROM public.attendance_operations
        WHERE actor_id = p_actor_id AND request_id = v_request;
    IF FOUND THEN
        IF v_receipt.payload_hash <> v_hash THEN
            RAISE EXCEPTION 'REQUEST_CONFLICT';
        END IF;
        RETURN v_receipt.result;
    END IF;
    IF v_status IS NOT NULL AND clock_timestamp() < v_starts THEN
        RAISE EXCEPTION 'TOO_EARLY';
    END IF;
    IF v_qr IS NOT NULL THEN
        SELECT id, name INTO v_child, v_name FROM public.children WHERE qr_token = v_qr FOR SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'INVALID_QR';
        END IF;
        v_children := ARRAY[v_child];
    ELSIF v_bulk THEN
        IF jsonb_typeof(p_payload->'childIds') IS DISTINCT FROM 'array'
            OR jsonb_array_length(p_payload->'childIds') NOT BETWEEN 1 AND 200 THEN
            RAISE EXCEPTION 'INVALID_REQUEST';
        END IF;
        SELECT array_agg(DISTINCT value::UUID ORDER BY value::UUID) INTO v_children
            FROM jsonb_array_elements_text(p_payload->'childIds');
    ELSE
        v_children := ARRAY[(p_payload->>'childId')::UUID];
    END IF;
    FOREACH v_child IN ARRAY v_children LOOP
        IF v_child IS NULL THEN
            RAISE EXCEPTION 'INVALID_REQUEST';
        END IF;
        PERFORM pg_advisory_xact_lock(hashtextextended(v_occurrence::TEXT || ':' || v_child::TEXT, 1));
        SELECT name INTO v_name FROM public.children WHERE id = v_child FOR SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'CHILD_NOT_FOUND';
        END IF;
        SELECT status INTO v_previous FROM public.attendance
            WHERE occurrence_id = v_occurrence AND child_id = v_child FOR UPDATE;
        IF v_bulk AND v_previous IS NOT NULL THEN
            CONTINUE;
        END IF;
        INSERT INTO public.attendance_accounting (occurrence_id, child_id)
            VALUES (v_occurrence, v_child) ON CONFLICT (occurrence_id, child_id) DO NOTHING;
        SELECT * INTO v_accounting FROM public.attendance_accounting
            WHERE occurrence_id = v_occurrence AND child_id = v_child FOR UPDATE;
        IF v_qr IS NOT NULL AND v_accounting.qr_processed THEN
            CONTINUE;
        END IF;
        IF v_qr IS NOT NULL AND (v_previous = 'ABSENT' OR
            (v_accounting.manual_override AND v_previous IS DISTINCT FROM 'PRESENT')) THEN
            RAISE EXCEPTION 'MANUAL_OVERRIDE';
        END IF;
        SELECT array_agg(e.id ORDER BY e.id) INTO v_enrollments FROM (
            SELECT id FROM public.enrollments
                WHERE kind = 'COURSE' AND entity_id = v_course AND child_id = v_child AND status = 'ACTIVE'
                ORDER BY id FOR UPDATE
        ) e;
        IF coalesce(cardinality(v_enrollments), 0) = 0 THEN
            RAISE EXCEPTION 'NOT_ENROLLED';
        END IF;
        IF cardinality(v_enrollments) <> 1 THEN
            RAISE EXCEPTION 'AMBIGUOUS_ENROLLMENT';
        END IF;
        SELECT * INTO v_enrollment FROM public.enrollments WHERE id = v_enrollments[1];
        IF v_enrollment.remaining_sessions < 0 OR v_enrollment.sessions_used < 0 THEN
            RAISE EXCEPTION 'INVALID_BALANCE';
        END IF;
        IF v_status = 'PRESENT' AND v_previous IS DISTINCT FROM 'PRESENT' THEN
            v_accounting.debit_monthly_package_id :=
                public.course_session_debit(v_enrollment.id, public.bucharest_date(v_starts));
            v_accounting.debit_enrollment_id := v_enrollment.id;
        ELSIF v_status IS DISTINCT FROM 'PRESENT' AND v_accounting.debit_enrollment_id IS NOT NULL THEN
            PERFORM public.course_session_credit(v_accounting.debit_enrollment_id,
                v_accounting.debit_monthly_package_id);
            v_accounting.debit_enrollment_id := NULL;
            v_accounting.debit_monthly_package_id := NULL;
        END IF;
        IF v_qr IS NULL OR v_previous IS DISTINCT FROM 'PRESENT' THEN
            IF v_status IS NULL THEN
                DELETE FROM public.attendance WHERE occurrence_id = v_occurrence AND child_id = v_child;
            ELSE
                INSERT INTO public.attendance (occurrence_id, child_id, status)
                    VALUES (v_occurrence, v_child, v_status)
                    ON CONFLICT (occurrence_id, child_id) DO UPDATE SET status = EXCLUDED.status;
            END IF;
            v_changed := true;
        END IF;
        UPDATE public.attendance_accounting SET
            debit_enrollment_id = v_accounting.debit_enrollment_id,
            debit_monthly_package_id = v_accounting.debit_monthly_package_id,
            manual_override = manual_override OR v_qr IS NULL,
            qr_processed = qr_processed OR v_qr IS NOT NULL,
            updated_at = now()
            WHERE id = v_accounting.id;
    END LOOP;
    v_result := jsonb_build_object('success', true, 'outcome', CASE WHEN v_changed THEN 'recorded' ELSE 'duplicate' END);
    IF NOT v_bulk THEN
        v_result := v_result || jsonb_build_object('childName', v_name);
    END IF;
    INSERT INTO public.attendance_operations (actor_id, request_id, payload_hash, result)
        VALUES (p_actor_id, v_request, v_hash, v_result);
    RETURN v_result;
EXCEPTION
    WHEN raise_exception THEN
        RETURN jsonb_build_object('success', false, 'code', SQLERRM);
    WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_REQUEST');
END;
$$;


CREATE OR REPLACE FUNCTION public.entrance_checkin_options(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_parent UUID := auth.uid();
    v_coach UUID;
    v_coach_name TEXT;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_options JSONB;
    v_next TIMESTAMPTZ;
BEGIN
    IF p_token IS NULL OR p_token !~ '^[0-9a-f]{32}$' THEN
        RAISE EXCEPTION 'INVALID_CODE';
    END IF;
    IF NOT EXISTS (SELECT FROM public.profiles WHERE id = v_parent AND role = 'PARENT'
        AND enabled AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;
    SELECT k.coach_id, p.name INTO v_coach, v_coach_name
        FROM public.coach_entrance_codes k JOIN public.profiles p ON p.id = k.coach_id
        WHERE k.token = p_token AND p.role IN ('COACH', 'ADMIN') AND p.enabled AND p.deleted_at IS NULL;
    IF v_coach IS NULL THEN
        RAISE EXCEPTION 'INVALID_CODE';
    END IF;
    WITH eligible AS (
        SELECT o.id AS occurrence_id, c.id AS course_id, c.name AS course_name,
            o.starts_at, o.ends_at, ch.id AS child_id, ch.name AS child_name,
            count(e.id) AS active_enrollments,
            min(public.course_sessions_available(e.id, public.bucharest_date(o.starts_at))) AS remaining_sessions,
            min(public.course_session_shortage(e.id, public.bucharest_date(o.starts_at))) AS shortage
        FROM public.course_occurrences o
        JOIN public.courses c ON c.id = o.course_id
        JOIN public.enrollments e ON e.kind = 'COURSE' AND e.entity_id = c.id AND e.status = 'ACTIVE'
        JOIN public.children ch ON ch.id = e.child_id AND ch.parent_id = v_parent
        WHERE c.coach_id = v_coach
            AND v_now >= o.starts_at - INTERVAL '15 minutes' AND v_now <= o.ends_at
        GROUP BY o.id, c.id, c.name, o.starts_at, o.ends_at, ch.id, ch.name
    )
    SELECT jsonb_agg(jsonb_build_object(
            'occurrenceId', x.occurrence_id, 'courseId', x.course_id, 'courseName', x.course_name,
            'startsAt', x.starts_at, 'endsAt', x.ends_at,
            'childId', x.child_id, 'childName', x.child_name,
            'remainingSessions', CASE WHEN x.active_enrollments = 1 THEN x.remaining_sessions END,
            'state', CASE
                WHEN a.status = 'PRESENT' THEN 'ALREADY_PRESENT'
                WHEN a.status = 'ABSENT' OR coalesce(acc.manual_override, false) THEN 'MANUAL_OVERRIDE'
                WHEN coalesce(acc.qr_processed, false) THEN 'ALREADY_PRESENT'
                WHEN x.active_enrollments <> 1 THEN 'AMBIGUOUS_ENROLLMENT'
                WHEN x.remaining_sessions <= 0 THEN coalesce(x.shortage, 'NO_REMAINING_SESSIONS')
                ELSE 'AVAILABLE' END)
        ORDER BY x.starts_at, x.course_name, x.child_name, x.child_id)
        INTO v_options
        FROM eligible x
        LEFT JOIN public.attendance a ON a.occurrence_id = x.occurrence_id AND a.child_id = x.child_id
        LEFT JOIN public.attendance_accounting acc
            ON acc.occurrence_id = x.occurrence_id AND acc.child_id = x.child_id;
    IF v_options IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'coachName', v_coach_name,
            'serverTime', v_now, 'options', v_options);
    END IF;
    IF NOT EXISTS (
        SELECT FROM public.enrollments e
        JOIN public.courses c ON c.id = e.entity_id
        JOIN public.children ch ON ch.id = e.child_id AND ch.parent_id = v_parent
        WHERE e.kind = 'COURSE' AND e.status = 'ACTIVE' AND c.coach_id = v_coach
    ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_ENROLLED', 'coachName', v_coach_name);
    END IF;
    SELECT min(o.starts_at) - INTERVAL '15 minutes' INTO v_next
        FROM public.course_occurrences o
        JOIN public.courses c ON c.id = o.course_id
        JOIN public.enrollments e ON e.kind = 'COURSE' AND e.entity_id = c.id AND e.status = 'ACTIVE'
        JOIN public.children ch ON ch.id = e.child_id AND ch.parent_id = v_parent
        WHERE c.coach_id = v_coach AND o.starts_at - INTERVAL '15 minutes' > v_now;
    RETURN jsonb_build_object('success', false, 'code', 'OUTSIDE_WINDOW', 'coachName', v_coach_name,
        'serverTime', v_now, 'nextOpensAt', v_next);
EXCEPTION
    WHEN raise_exception THEN
        RETURN jsonb_build_object('success', false, 'code', SQLERRM);
END;
$$;


CREATE OR REPLACE FUNCTION public.entrance_checkin(p_token TEXT, p_occurrence_id UUID, p_child_id UUID, p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_parent UUID := auth.uid();
    v_coach UUID;
    v_course UUID;
    v_course_name TEXT;
    v_course_coach UUID;
    v_starts TIMESTAMPTZ;
    v_ends TIMESTAMPTZ;
    v_now TIMESTAMPTZ;
    v_child_name TEXT;
    v_previous TEXT;
    v_hash TEXT;
    v_receipt public.attendance_operations%ROWTYPE;
    v_accounting public.attendance_accounting%ROWTYPE;
    v_enrollment public.enrollments%ROWTYPE;
    v_enrollments UUID[];
    v_changed BOOLEAN := false;
    v_result JSONB;
BEGIN
    IF p_occurrence_id IS NULL OR p_child_id IS NULL OR p_request_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_REQUEST';
    END IF;
    IF p_token IS NULL OR p_token !~ '^[0-9a-f]{32}$' THEN
        RAISE EXCEPTION 'INVALID_CODE';
    END IF;
    PERFORM FROM public.profiles WHERE id = v_parent AND role = 'PARENT'
        AND enabled AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_parent::TEXT || ':' || p_request_id::TEXT, 0));
    v_hash := md5(jsonb_build_object('entrance', true, 'occurrenceId', p_occurrence_id,
        'childId', p_child_id)::TEXT);
    SELECT k.coach_id INTO v_coach
        FROM public.coach_entrance_codes k JOIN public.profiles p ON p.id = k.coach_id
        WHERE k.token = p_token AND p.role IN ('COACH', 'ADMIN') AND p.enabled AND p.deleted_at IS NULL;
    IF v_coach IS NULL THEN
        RAISE EXCEPTION 'INVALID_CODE';
    END IF;
    SELECT o.course_id, c.name, c.coach_id, o.starts_at, o.ends_at
        INTO v_course, v_course_name, v_course_coach, v_starts, v_ends
        FROM public.course_occurrences o JOIN public.courses c ON c.id = o.course_id
        WHERE o.id = p_occurrence_id FOR SHARE OF o, c;
    IF NOT FOUND OR v_course_coach <> v_coach THEN
        RAISE EXCEPTION 'OCCURRENCE_NOT_FOUND';
    END IF;
    SELECT name INTO v_child_name FROM public.children
        WHERE id = p_child_id AND parent_id = v_parent FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'CHILD_NOT_FOUND';
    END IF;
    SELECT * INTO v_receipt FROM public.attendance_operations
        WHERE actor_id = v_parent AND request_id = p_request_id;
    IF FOUND THEN
        IF v_receipt.payload_hash <> v_hash THEN
            RAISE EXCEPTION 'REQUEST_CONFLICT';
        END IF;
        RETURN v_receipt.result;
    END IF;
    v_now := clock_timestamp();
    IF v_now < v_starts - INTERVAL '15 minutes' OR v_now > v_ends THEN
        RAISE EXCEPTION 'OUTSIDE_WINDOW';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_occurrence_id::TEXT || ':' || p_child_id::TEXT, 1));
    SELECT status INTO v_previous FROM public.attendance
        WHERE occurrence_id = p_occurrence_id AND child_id = p_child_id FOR UPDATE;
    INSERT INTO public.attendance_accounting (occurrence_id, child_id)
        VALUES (p_occurrence_id, p_child_id) ON CONFLICT (occurrence_id, child_id) DO NOTHING;
    SELECT * INTO v_accounting FROM public.attendance_accounting
        WHERE occurrence_id = p_occurrence_id AND child_id = p_child_id FOR UPDATE;
    SELECT array_agg(e.id ORDER BY e.id) INTO v_enrollments FROM (
        SELECT id FROM public.enrollments
            WHERE kind = 'COURSE' AND entity_id = v_course AND child_id = p_child_id AND status = 'ACTIVE'
            ORDER BY id FOR UPDATE
    ) e;
    IF coalesce(cardinality(v_enrollments), 0) = 0 THEN
        RAISE EXCEPTION 'NOT_ENROLLED';
    END IF;
    IF v_previous = 'ABSENT' OR (v_accounting.manual_override AND v_previous IS DISTINCT FROM 'PRESENT') THEN
        RAISE EXCEPTION 'MANUAL_OVERRIDE';
    END IF;
    IF NOT v_accounting.qr_processed THEN
        IF cardinality(v_enrollments) <> 1 THEN
            RAISE EXCEPTION 'AMBIGUOUS_ENROLLMENT';
        END IF;
        SELECT * INTO v_enrollment FROM public.enrollments WHERE id = v_enrollments[1];
        IF v_enrollment.remaining_sessions < 0 OR v_enrollment.sessions_used < 0 THEN
            RAISE EXCEPTION 'INVALID_BALANCE';
        END IF;
        IF v_previous IS DISTINCT FROM 'PRESENT' THEN
            v_accounting.debit_monthly_package_id :=
                public.course_session_debit(v_enrollment.id, public.bucharest_date(v_starts));
            INSERT INTO public.attendance (occurrence_id, child_id, status)
                VALUES (p_occurrence_id, p_child_id, 'PRESENT')
                ON CONFLICT (occurrence_id, child_id) DO UPDATE SET status = EXCLUDED.status;
            v_accounting.debit_enrollment_id := v_enrollment.id;
            v_changed := true;
        END IF;
        UPDATE public.attendance_accounting SET
            debit_enrollment_id = v_accounting.debit_enrollment_id,
            debit_monthly_package_id = v_accounting.debit_monthly_package_id,
            qr_processed = true,
            updated_at = now()
            WHERE id = v_accounting.id;
    END IF;
    v_result := jsonb_build_object('success', true,
        'outcome', CASE WHEN v_changed THEN 'recorded' ELSE 'duplicate' END,
        'occurrenceId', p_occurrence_id, 'childId', p_child_id,
        'childName', v_child_name, 'courseName', v_course_name, 'startsAt', v_starts,
        'attendanceStatus', (SELECT status FROM public.attendance
            WHERE occurrence_id = p_occurrence_id AND child_id = p_child_id),
        'remainingSessions', CASE WHEN cardinality(v_enrollments) = 1 THEN
            public.course_sessions_available(v_enrollments[1], public.bucharest_date(v_starts)) END);
    INSERT INTO public.attendance_operations (actor_id, request_id, payload_hash, result)
        VALUES (v_parent, p_request_id, v_hash, v_result);
    RETURN v_result;
EXCEPTION
    WHEN raise_exception THEN
        RETURN jsonb_build_object('success', false, 'code', SQLERRM);
END;
$$;

NOTIFY pgrst, 'reload schema';
