-- Feature TT #699: course packages that expire a number of days after the
-- payment is confirmed („expiră după N zile”). Owner decisions of 2026-11-20
-- (cards at 11:24Z): the coach or club chooses N per course, between 7 and 365;
-- the days run from the payment confirmation (card: the day Stripe confirms it;
-- cash: the day the coach or club confirms the cash); every package keeps its
-- own expiry, so a renewal never moves the sessions left in an older package.
-- Unused sessions are lost, as for monthly packages.
--
--   * course_packages.validity gains 'DAYS' and validity_days (7..365).
--     save_course_packages now refuses a list that mixes validities (owner
--     card 11:49Z: one validity for all packages of a course) or DAYS
--     packages with different N.
--   * the v3 price snapshot of a DAYS package has a 14th key, validDays.
--   * a confirmed DAYS payment creates one enrollment_monthly_packages row with
--     validity 'DAYS', valid_from = the Bucharest date of the confirmation and
--     valid_until = valid_from + N - 1 (N calendar days, the confirmation day
--     included). The table keeps its 00150 name; 00151's attendance paths
--     already debit any row by its [valid_from, valid_until] range, earliest
--     expiry first, so they need no change.
--
-- Replaced functions are checked against their live md5 first (00150).

DO $guard$
DECLARE
    v_expected CONSTANT JSONB := jsonb_build_object(
        'apply_enrollment_payment_result', '1b499698099ab64ecf2fd3f83fc20a24',
        'save_course_packages', 'f782270666e77453aefd293d0c89f3b0',
        'valid_course_package_price_snapshot', 'cfd8c33548dd47e16748138774923396',
        'course_quote_matches_offer', '2bdaf7b3424bc99b4efac4dd112392bb');
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

ALTER TABLE public.course_packages DROP CONSTRAINT course_packages_validity_check;
ALTER TABLE public.course_packages
    ADD COLUMN validity_days SMALLINT,
    ADD CONSTRAINT course_packages_validity_check CHECK (validity IN ('NONE', 'CALENDAR_MONTH', 'DAYS')),
    ADD CONSTRAINT course_packages_validity_days_check CHECK (
        CASE WHEN validity = 'DAYS' THEN COALESCE(validity_days BETWEEN 7 AND 365, false)
            ELSE validity_days IS NULL END);

ALTER TABLE public.enrollment_monthly_packages DROP CONSTRAINT enrollment_monthly_packages_month_check;
ALTER TABLE public.enrollment_monthly_packages
    ADD COLUMN validity TEXT NOT NULL DEFAULT 'CALENDAR_MONTH',
    ADD CONSTRAINT enrollment_monthly_packages_validity_check CHECK (validity IN ('CALENDAR_MONTH', 'DAYS')),
    ADD CONSTRAINT enrollment_monthly_packages_period_check CHECK (
        CASE validity
            WHEN 'CALENDAR_MONTH' THEN valid_from = date_trunc('month', valid_from)::DATE
                AND valid_until = (valid_from + INTERVAL '1 month' - INTERVAL '1 day')::DATE
            ELSE valid_until BETWEEN valid_from + 6 AND valid_from + 364
        END);

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
    v_days BOOLEAN;
    v_keys INTEGER;
BEGIN
    v_monthly := p_snapshot->>'validity' IS NOT DISTINCT FROM 'CALENDAR_MONTH';
    v_days := p_snapshot->>'validity' IS NOT DISTINCT FROM 'DAYS';
    v_keys := CASE WHEN v_monthly OR v_days THEN 14 ELSE 13 END;
    IF jsonb_typeof(p_snapshot) IS DISTINCT FROM 'object'
        OR NOT p_snapshot ?& ARRAY['schemaVersion','kind','entityId','childId','packageId','validity',
            'sourcePackageAmount','sourceCurrency','quantity','eurRonRateMicros','amount','currency','priceVersion']
        OR (SELECT count(*) FROM jsonb_object_keys(p_snapshot)) <> v_keys
        OR p_snapshot->'schemaVersion' IS DISTINCT FROM '3'::JSONB
        OR p_snapshot->>'kind' IS DISTINCT FROM 'COURSE'
        OR (p_snapshot->>'validity' IN ('NONE','CALENDAR_MONTH','DAYS')) IS DISTINCT FROM TRUE
        OR (v_monthly AND (p_snapshot->>'validMonth' ~ '^[0-9]{4}-(0[1-9]|1[0-2])$') IS DISTINCT FROM TRUE)
        OR (v_days AND (jsonb_typeof(p_snapshot->'validDays') IS DISTINCT FROM 'number'
            OR (p_snapshot->>'validDays' ~ '^[0-9]{1,3}$') IS DISTINCT FROM TRUE
            OR (p_snapshot->>'validDays')::INTEGER NOT BETWEEN 7 AND 365))
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
                              WHEN 'NONE' THEN NOT p_snapshot ? 'validMonth' AND NOT p_snapshot ? 'validDays'
                              WHEN 'CALENDAR_MONTH' THEN NOT p_snapshot ? 'validDays'
                                  AND p_snapshot->>'validMonth' IN (
                                  to_char(public.bucharest_date(now()), 'YYYY-MM'),
                                  to_char(date_trunc('month', public.bucharest_date(now())) + INTERVAL '1 month', 'YYYY-MM'))
                              WHEN 'DAYS' THEN NOT p_snapshot ? 'validMonth'
                                  AND p_snapshot->'validDays' = to_jsonb(p.validity_days::INTEGER)
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
        WITH i AS (SELECT COALESCE(NULLIF(e.value->>'validity', ''), 'NONE') AS validity,
                   (NULLIF(e.value->>'validityDays', ''))::smallint AS validity_days
            FROM jsonb_array_elements(p_packages) AS e(value))
        SELECT 1 FROM i
        HAVING count(DISTINCT (i.validity, i.validity_days)) > 1
    ) THEN
        RAISE EXCEPTION 'Pachetele unui curs au toate aceeași valabilitate și același număr de zile'
            USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        WITH i AS (SELECT NULLIF(e.value->>'id', '')::uuid AS id
            FROM jsonb_array_elements(p_packages) AS e(value))
        SELECT 1 FROM i
        WHERE i.id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.course_packages p
              WHERE p.id = i.id AND p.course_id = p_course_id
          )
    ) OR (
        WITH i AS (SELECT NULLIF(e.value->>'id', '')::uuid AS id
            FROM jsonb_array_elements(p_packages) AS e(value))
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
                   COALESCE(NULLIF(e.value->>'validity', ''), 'NONE') AS validity,
                   (NULLIF(e.value->>'validityDays', ''))::smallint AS validity_days
            FROM jsonb_array_elements(p_packages) WITH ORDINALITY AS e(value, ordinality))
    UPDATE public.course_packages p
       SET position = i.position,
           sessions = i.sessions,
           price = i.price,
           validity = i.validity,
           validity_days = i.validity_days,
           updated_at = now()
      FROM i
     WHERE p.id = i.id
       AND p.course_id = p_course_id
       AND (p.position, p.sessions, p.price, p.validity, p.validity_days)
           IS DISTINCT FROM (i.position, i.sessions, i.price, i.validity, i.validity_days);

    WITH i AS (SELECT NULLIF(e.value->>'id', '')::uuid AS id,
                   (e.ordinality - 1)::smallint AS position,
                   (e.value->>'sessions')::integer AS sessions,
                   (e.value->>'price')::bigint AS price,
                   COALESCE(NULLIF(e.value->>'validity', ''), 'NONE') AS validity,
                   (NULLIF(e.value->>'validityDays', ''))::smallint AS validity_days
            FROM jsonb_array_elements(p_packages) WITH ORDINALITY AS e(value, ordinality))
    INSERT INTO public.course_packages (course_id, position, sessions, price, validity, validity_days)
    SELECT p_course_id, i.position, i.sessions, i.price, i.validity, i.validity_days
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
    v_days_start DATE;
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
        ELSIF v_payment.pricing_snapshot->>'validity' = 'DAYS' THEN
            v_days_start := public.bucharest_date(now());
            INSERT INTO public.enrollment_monthly_packages (enrollment_id, payment_id, package_id, sessions,
                valid_from, valid_until, validity)
            VALUES (v_enrollment.id, v_payment.id,
                (SELECT p.id FROM public.course_packages p
                    WHERE p.id::TEXT = v_payment.pricing_snapshot->>'packageId'),
                v_sessions, v_days_start,
                v_days_start + ((v_payment.pricing_snapshot->>'validDays')::INTEGER - 1), 'DAYS');
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

NOTIFY pgrst, 'reload schema';
