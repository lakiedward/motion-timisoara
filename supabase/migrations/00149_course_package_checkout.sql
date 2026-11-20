-- Feature TT #697: a parent buys one of the course's packages (course_packages,
-- 00148) at checkout, by card or cash, for a first enrollment or a renewal
-- (00147). One payments row = one purchased package; its accepted price
-- snapshot is the purchase record that #698 (monthly validity) builds on.
--
-- Package purchases carry price snapshot schemaVersion 3: packageId, validity,
-- sourcePackageAmount (the package's total price in the course currency, minor
-- units), quantity (= package sessions, which apply_enrollment_payment_result
-- already adds to the enrollment on confirmation) and the converted RON amount.
-- The total is not a per-session price, so it has its own key instead of
-- sourceUnitAmount and older readers never multiply it.
--
-- course_quote_matches_offer() is the server-side price check for courses:
-- where a course has packages, only a version-3 snapshot of one of its current
-- packages is accepted (price, sessions and validity re-read from
-- course_packages, never trusted from the client); a course without packages
-- keeps the per-session version-1 snapshot exactly as before. Courses lock
-- their row in save_enrollment_batch (FOR UPDATE) and start_course_renewal
-- (FOR SHARE), and save_course_packages locks it FOR NO KEY UPDATE, so packages
-- cannot change between the check and the payment insert.
--
-- Only NONE (no expiry) packages are sold: the monthly validity belongs to
-- #698, which will extend valid_course_package_price_snapshot and the match.
--
-- save_enrollment_batch is 00068 with the course price check replaced (live
-- md5 matched 00068 before this change); start_course_renewal is 00147 with
-- the same replacement; valid_enrollment_price_snapshot is 00072 plus the
-- version-3 dispatch.

DO $guard$
DECLARE
    v_md5 TEXT;
BEGIN
    SELECT md5(p.prosrc) INTO v_md5 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'save_enrollment_batch';
    IF v_md5 IS DISTINCT FROM 'fc09320a8a2f4c823437099b67ee1337' THEN
        RAISE EXCEPTION 'save_enrollment_batch differs from 00068 (md5 %); stop and compare', v_md5;
    END IF;
    SELECT md5(p.prosrc) INTO v_md5 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'start_course_renewal';
    IF v_md5 IS DISTINCT FROM '079fb697c43b993d4023c71f41ab1a82' THEN
        RAISE EXCEPTION 'start_course_renewal differs from 00147 (md5 %); apply 00147 first or compare', v_md5;
    END IF;
    IF to_regclass('public.course_packages') IS NULL THEN
        RAISE EXCEPTION 'course_packages (00148) is missing';
    END IF;
END
$guard$;

CREATE FUNCTION public.valid_course_package_price_snapshot(
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
BEGIN
    IF jsonb_typeof(p_snapshot) IS DISTINCT FROM 'object'
        OR NOT p_snapshot ?& ARRAY['schemaVersion','kind','entityId','childId','packageId','validity',
            'sourcePackageAmount','sourceCurrency','quantity','eurRonRateMicros','amount','currency','priceVersion']
        OR (SELECT count(*) FROM jsonb_object_keys(p_snapshot)) <> 13
        OR p_snapshot->'schemaVersion' IS DISTINCT FROM '3'::JSONB
        OR p_snapshot->>'kind' IS DISTINCT FROM 'COURSE'
        OR p_snapshot->>'validity' IS DISTINCT FROM 'NONE'
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

REVOKE ALL ON FUNCTION public.valid_course_package_price_snapshot(JSONB, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.valid_course_package_price_snapshot(JSONB, BIGINT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.valid_enrollment_price_snapshot(
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
    v_unit NUMERIC;
    v_quantity NUMERIC;
    v_rate NUMERIC;
    v_source NUMERIC;
    v_result NUMERIC;
    v_has_child BOOLEAN;
    v_has_adult BOOLEAN;
BEGIN
    IF p_snapshot IS NULL THEN RETURN TRUE; END IF;
    IF p_snapshot->'schemaVersion' = '2'::JSONB THEN
        RETURN public.valid_competition_price_snapshot(p_snapshot, p_amount, p_currency);
    END IF;
    IF p_snapshot->'schemaVersion' = '3'::JSONB THEN
        RETURN public.valid_course_package_price_snapshot(p_snapshot, p_amount, p_currency);
    END IF;
    IF jsonb_typeof(p_snapshot) IS DISTINCT FROM 'object'
        OR NOT p_snapshot ?& ARRAY['schemaVersion','kind','entityId','childId','sourceUnitAmount',
            'sourceCurrency','quantity','eurRonRateMicros','amount','currency','priceVersion']
        OR p_snapshot->'schemaVersion' IS DISTINCT FROM '1'::JSONB
        OR (p_snapshot->>'kind' IN ('COURSE','CAMP','ACTIVITY')) IS DISTINCT FROM TRUE
        OR (p_snapshot->>'sourceCurrency' IN ('RON','EUR')) IS DISTINCT FROM TRUE
        OR p_snapshot->>'currency' IS DISTINCT FROM 'RON' OR p_currency IS DISTINCT FROM 'RON'
        OR (p_snapshot->>'entityId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS DISTINCT FROM TRUE
        OR (p_snapshot->>'priceVersion' ~ '^[0-9a-f]{64}$') IS DISTINCT FROM TRUE
        OR jsonb_typeof(p_snapshot->'sourceUnitAmount') IS DISTINCT FROM 'number'
        OR jsonb_typeof(p_snapshot->'quantity') IS DISTINCT FROM 'number'
        OR jsonb_typeof(p_snapshot->'amount') IS DISTINCT FROM 'number'
    THEN RETURN FALSE; END IF;
    v_has_child := (p_snapshot->>'childId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS TRUE;
    v_has_adult := (p_snapshot->>'adultProfileId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS TRUE;
    IF v_has_child = v_has_adult THEN RETURN FALSE; END IF;
    IF v_has_adult AND p_snapshot->>'kind' IS DISTINCT FROM 'CAMP' THEN RETURN FALSE; END IF;
    v_unit := (p_snapshot->>'sourceUnitAmount')::NUMERIC;
    v_quantity := (p_snapshot->>'quantity')::NUMERIC;
    IF v_unit <> trunc(v_unit) OR v_unit NOT BETWEEN 0 AND 9007199254740991
        OR v_quantity <> trunc(v_quantity) OR v_quantity NOT BETWEEN 1 AND 9007199254740991
        OR (p_snapshot->>'kind' <> 'COURSE' AND v_quantity <> 1)
    THEN RETURN FALSE; END IF;
    v_source := v_unit * v_quantity;
    IF v_source > 9007199254740991 THEN RETURN FALSE; END IF;
    IF p_snapshot->>'sourceCurrency' = 'EUR' THEN
        IF jsonb_typeof(p_snapshot->'eurRonRateMicros') IS DISTINCT FROM 'number' THEN RETURN FALSE; END IF;
        v_rate := (p_snapshot->>'eurRonRateMicros')::NUMERIC;
        IF v_rate <> trunc(v_rate) OR v_rate NOT BETWEEN 1 AND 9007199254740991 THEN RETURN FALSE; END IF;
        v_result := floor((v_source * v_rate + 500000) / 1000000);
    ELSE
        IF p_snapshot->'eurRonRateMicros' IS DISTINCT FROM 'null'::JSONB THEN RETURN FALSE; END IF;
        v_result := v_source;
    END IF;
    RETURN (v_result <= 9007199254740991 AND v_result = p_amount
        AND v_result = (p_snapshot->>'amount')::NUMERIC) IS TRUE;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN FALSE;
END;
$$;

CREATE FUNCTION public.course_quote_matches_offer(p_course_id UUID, p_snapshot JSONB)
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
                          AND p.validity = 'NONE'
                          AND p_snapshot->>'validity' = p.validity
                          AND to_jsonb(p.sessions) = p_snapshot->'quantity'
                          AND to_jsonb(p.price) = p_snapshot->'sourcePackageAmount')
                ELSE
                    p_snapshot->'schemaVersion' = '1'::JSONB
                    AND to_jsonb(c.price_per_session) = p_snapshot->'sourceUnitAmount'
            END
        FROM public.courses c
        WHERE c.id = p_course_id
    ), false)
$$;

REVOKE ALL ON FUNCTION public.course_quote_matches_offer(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.course_quote_matches_offer(UUID, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.save_enrollment_batch(
    p_parent_id UUID,
    p_kind TEXT,
    p_entity_id UUID,
    p_method TEXT,
    p_quotes JSONB,
    p_billing JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_offer JSONB;
    v_quote JSONB;
    v_snapshot JSONB;
    v_child public.children;
    v_enrollment public.enrollments;
    v_payment public.payments;
    v_child_id UUID;
    v_adult_id UUID;
    v_count INTEGER;
    v_occupied INTEGER;
    v_amount BIGINT;
    v_source JSONB;
    v_ids JSONB := '[]'::JSONB;
    v_created JSONB := '[]'::JSONB;
    v_prices JSONB := '[]'::JSONB;
    v_exists BOOLEAN;
    v_needs_card BOOLEAN;
    v_price_row JSONB;
BEGIN
    IF p_parent_id IS NULL OR p_entity_id IS NULL
        OR p_kind IS NULL OR p_kind NOT IN ('COURSE','ACTIVITY','CAMP')
        OR p_method IS NULL OR p_method NOT IN ('CARD','CASH')
        OR jsonb_typeof(p_quotes) IS DISTINCT FROM 'array'
        OR jsonb_array_length(p_quotes) = 0
        OR (p_billing IS NOT NULL AND jsonb_typeof(p_billing) IS DISTINCT FROM 'object') THEN
        RAISE EXCEPTION 'Cererea de înscriere nu este validă.' USING ERRCODE = '22023';
    END IF;
    PERFORM 1 FROM public.profiles WHERE id = p_parent_id AND role = 'PARENT' FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Doar părinții pot înscrie copii.' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_quotes) q
        WHERE ((q->>'childId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS TRUE)
            = ((q->>'adultProfileId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS TRUE)
    ) THEN
        RAISE EXCEPTION 'Selecția participanților nu este validă.' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_quotes) q
        WHERE q->>'adultProfileId' IS NOT NULL AND p_kind IS DISTINCT FROM 'CAMP'
    ) THEN
        RAISE EXCEPTION 'Selecția participanților nu este validă.' USING ERRCODE = '22023';
    END IF;
    IF (SELECT count(*) FROM (
            SELECT DISTINCT COALESCE(q->>'childId', '') || ':' || COALESCE(q->>'adultProfileId', '')
            FROM jsonb_array_elements(p_quotes) q
        ) s) <> jsonb_array_length(p_quotes) THEN
        RAISE EXCEPTION 'Selecția copiilor nu este validă.' USING ERRCODE = '22023';
    END IF;

    IF p_kind = 'COURSE' THEN
        SELECT to_jsonb(c) INTO v_offer FROM public.courses c WHERE id = p_entity_id FOR UPDATE;
    ELSIF p_kind = 'ACTIVITY' THEN
        SELECT to_jsonb(a) INTO v_offer FROM public.activities a WHERE id = p_entity_id FOR UPDATE;
    ELSE
        SELECT to_jsonb(c) INTO v_offer FROM public.camps c WHERE id = p_entity_id FOR UPDATE;
    END IF;
    IF v_offer IS NULL THEN
        RAISE EXCEPTION 'Oferta nu a fost găsită.' USING ERRCODE = 'P0002';
    END IF;
    IF p_kind <> 'CAMP' AND (v_offer->>'active')::BOOLEAN IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Oferta nu mai este activă.' USING ERRCODE = '23514';
    END IF;
    IF p_kind = 'CAMP' AND p_method = 'CASH' AND (v_offer->>'allow_cash')::BOOLEAN IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Plata cash nu este disponibilă pentru această tabără.' USING ERRCODE = '23514';
    END IF;

    FOR v_quote IN SELECT q FROM jsonb_array_elements(p_quotes) q
        ORDER BY COALESCE(q->>'childId', q->>'adultProfileId')
    LOOP
        v_child_id := NULLIF(v_quote->>'childId', '')::UUID;
        v_adult_id := NULLIF(v_quote->>'adultProfileId', '')::UUID;
        v_amount := (v_quote->>'amount')::BIGINT;
        v_snapshot := nullif(v_quote->'snapshot', 'null'::JSONB);
        IF v_amount IS NULL OR v_amount < 0 OR v_amount > 9007199254740991
            OR v_quote->>'currency' IS DISTINCT FROM 'RON'
            OR public.valid_enrollment_price_snapshot(v_snapshot, v_amount, 'RON') IS DISTINCT FROM true
            OR (v_snapshot IS NOT NULL AND (
                v_snapshot->>'kind' IS DISTINCT FROM p_kind
                OR v_snapshot->>'entityId' IS DISTINCT FROM p_entity_id::TEXT
                OR v_snapshot->>'priceVersion' IS DISTINCT FROM v_quote->>'priceVersion'
                OR (v_child_id IS NOT NULL AND v_snapshot->>'childId' IS DISTINCT FROM v_child_id::TEXT)
                OR (v_adult_id IS NOT NULL AND (
                    v_snapshot->>'adultProfileId' IS DISTINCT FROM v_adult_id::TEXT
                    OR v_snapshot->>'childId' IS NOT NULL)))) THEN
            RAISE EXCEPTION 'Oferta confirmată nu este validă.' USING ERRCODE = '23514';
        END IF;
        IF v_adult_id IS NOT NULL THEN
            IF v_adult_id IS DISTINCT FROM p_parent_id THEN
                RAISE EXCEPTION 'Poți să te înscrii doar pe tine ca adult.' USING ERRCODE = '42501';
            END IF;
            PERFORM 1 FROM public.enrollments WHERE kind = p_kind AND entity_id = p_entity_id
                AND adult_profile_id = v_adult_id AND status IN ('PENDING','ACTIVE') ORDER BY id FOR UPDATE;
            SELECT count(*) INTO v_count FROM public.enrollments WHERE kind = p_kind AND entity_id = p_entity_id
                AND adult_profile_id = v_adult_id AND status IN ('PENDING','ACTIVE');
            IF v_count > 1 THEN
                RAISE EXCEPTION 'Înscrierea are nevoie de verificare. Contactează clubul.' USING ERRCODE = '23514';
            END IF;
            SELECT * INTO v_enrollment FROM public.enrollments WHERE kind = p_kind AND entity_id = p_entity_id
                AND adult_profile_id = v_adult_id AND status IN ('PENDING','ACTIVE');
        ELSE
            SELECT * INTO v_child FROM public.children WHERE id = v_child_id FOR SHARE;
            IF NOT FOUND OR v_child.parent_id IS DISTINCT FROM p_parent_id THEN
                RAISE EXCEPTION 'Copilul nu îți aparține.' USING ERRCODE = '42501';
            END IF;
            IF p_kind = 'COURSE' AND (
                extract(year FROM age(current_date, v_child.birth_date)) < (v_offer->>'age_from')::INTEGER
                OR extract(year FROM age(current_date, v_child.birth_date)) > (v_offer->>'age_to')::INTEGER) THEN
                RAISE EXCEPTION 'Vârsta copilului nu corespunde cursului.' USING ERRCODE = '23514';
            END IF;
            PERFORM 1 FROM public.enrollments WHERE kind = p_kind AND entity_id = p_entity_id
                AND child_id = v_child_id AND status IN ('PENDING','ACTIVE') ORDER BY id FOR UPDATE;
            SELECT count(*) INTO v_count FROM public.enrollments WHERE kind = p_kind AND entity_id = p_entity_id
                AND child_id = v_child_id AND status IN ('PENDING','ACTIVE');
            IF v_count > 1 THEN
                RAISE EXCEPTION 'Înscrierea are nevoie de verificare. Contactează clubul.' USING ERRCODE = '23514';
            END IF;
            SELECT * INTO v_enrollment FROM public.enrollments WHERE kind = p_kind AND entity_id = p_entity_id
                AND child_id = v_child_id AND status IN ('PENDING','ACTIVE');
        END IF;
        v_exists := FOUND;
        v_payment := NULL;
        IF v_exists THEN
            IF p_method = 'CASH' THEN
                RAISE EXCEPTION 'Există deja o înscriere. Verifică în Înscrieri.' USING ERRCODE = '23514';
            END IF;
            PERFORM 1 FROM public.payments WHERE enrollment_id = v_enrollment.id ORDER BY id FOR UPDATE;
            SELECT count(*) INTO v_count FROM public.payments WHERE enrollment_id = v_enrollment.id;
            IF v_count > 1 THEN
                RAISE EXCEPTION 'Plata are nevoie de verificare. Contactează clubul.' USING ERRCODE = '23514';
            END IF;
            SELECT * INTO v_payment FROM public.payments WHERE enrollment_id = v_enrollment.id;
            IF v_enrollment.status = 'ACTIVE' THEN
                IF v_payment.id IS NULL OR v_payment.status <> 'SUCCEEDED' OR v_snapshot IS NULL
                    OR v_payment.pricing_snapshot IS DISTINCT FROM v_snapshot
                    OR v_payment.amount IS DISTINCT FROM v_amount OR v_payment.currency <> 'RON'
                    OR (v_amount > 0 AND (v_payment.method <> 'CARD' OR v_payment.gateway_txn_id IS NULL)) THEN
                    RAISE EXCEPTION 'Înscrierea este deja procesată. Verifică în Înscrieri.' USING ERRCODE = '23514';
                END IF;
                v_ids := v_ids || jsonb_build_array(v_enrollment.id);
                v_price_row := jsonb_build_object('amount',v_amount,'currency','RON');
                IF v_child_id IS NOT NULL THEN v_price_row := v_price_row || jsonb_build_object('childId',v_child_id); END IF;
                IF v_adult_id IS NOT NULL THEN v_price_row := v_price_row || jsonb_build_object('adultProfileId',v_adult_id); END IF;
                v_prices := v_prices || jsonb_build_array(v_price_row);
                CONTINUE;
            END IF;
            IF v_payment.id IS NOT NULL AND v_payment.status NOT IN ('PENDING','FAILED','CANCELLED') THEN
                RAISE EXCEPTION 'Plata este deja procesată. Verifică în Înscrieri.' USING ERRCODE = '23514';
            END IF;
        END IF;

        IF v_payment.gateway_txn_id IS NOT NULL OR v_payment.pricing_snapshot IS NOT NULL THEN
            IF v_payment.amount IS DISTINCT FROM v_amount OR v_payment.currency IS DISTINCT FROM 'RON'
                OR v_payment.pricing_snapshot IS DISTINCT FROM v_snapshot THEN
                RAISE EXCEPTION 'Plata s-a schimbat. Verifică din nou înscrierea.' USING ERRCODE = '23514', DETAIL = 'PRICE_CHANGED';
            END IF;
        ELSE
            IF v_snapshot IS NULL THEN
                RAISE EXCEPTION 'Lipsește oferta confirmată.' USING ERRCODE = '23514';
            END IF;
            IF p_kind = 'CAMP' AND v_adult_id IS NOT NULL THEN
                v_source := public.enrollment_camp_adult_offer(p_entity_id);
            ELSIF p_kind = 'CAMP' THEN
                v_source := public.enrollment_camp_offer(p_entity_id, v_child_id);
            ELSIF p_kind = 'COURSE' THEN
                v_source := NULL;
            ELSE
                v_source := jsonb_build_object('amount', v_offer->'price',
                    'currency',v_offer->'currency','eur_ron_rate_micros',v_offer->'eur_ron_rate_micros');
            END IF;
            IF p_kind = 'COURSE' THEN
                IF public.course_quote_matches_offer(p_entity_id, v_snapshot) IS DISTINCT FROM true THEN
                    RAISE EXCEPTION 'Prețul s-a schimbat. Revino la Detalii și confirmă suma.' USING ERRCODE = '23514', DETAIL = 'PRICE_CHANGED';
                END IF;
            ELSIF v_source IS NULL OR v_source->'amount' IS DISTINCT FROM v_snapshot->'sourceUnitAmount'
                OR v_source->'currency' IS DISTINCT FROM v_snapshot->'sourceCurrency'
                OR coalesce(v_source->'eur_ron_rate_micros','null'::JSONB) IS DISTINCT FROM v_snapshot->'eurRonRateMicros' THEN
                RAISE EXCEPTION 'Prețul s-a schimbat. Revino la Detalii și confirmă suma.' USING ERRCODE = '23514', DETAIL = 'PRICE_CHANGED';
            END IF;
        END IF;

        IF NOT v_exists THEN
            SELECT count(*) INTO v_occupied FROM public.enrollments WHERE kind = p_kind AND entity_id = p_entity_id AND status IN ('PENDING','ACTIVE');
            IF (v_offer->>'capacity')::INTEGER IS NOT NULL AND v_occupied >= (v_offer->>'capacity')::INTEGER THEN
                RAISE EXCEPTION 'Nu mai sunt locuri suficiente pentru selecția ta.' USING ERRCODE = '23514';
            END IF;
            INSERT INTO public.enrollments(kind,entity_id,child_id,adult_profile_id,status,purchased_sessions,remaining_sessions,sessions_used)
                VALUES(p_kind,p_entity_id,v_child_id,v_adult_id,'PENDING',0,0,0) RETURNING * INTO v_enrollment;
            v_created := v_created || jsonb_build_array(v_enrollment.id);
        END IF;
        IF v_payment.id IS NULL THEN
            INSERT INTO public.payments(enrollment_id,method,amount,currency,pricing_snapshot,status,
                billing_name,billing_email,billing_address_line1,billing_city,billing_postal_code,billing_country)
            VALUES(v_enrollment.id,p_method,v_amount,'RON',v_snapshot,'PENDING',
                CASE WHEN p_method='CARD' THEN p_billing->>'name' END,CASE WHEN p_method='CARD' THEN p_billing->>'email' END,
                CASE WHEN p_method='CARD' THEN p_billing->>'addressLine1' END,CASE WHEN p_method='CARD' THEN p_billing->>'city' END,
                CASE WHEN p_method='CARD' THEN p_billing->>'postalCode' END,CASE WHEN p_method='CARD' AND p_billing IS NOT NULL THEN 'RO' END);
        ELSIF v_payment.method IS DISTINCT FROM p_method OR v_payment.status <> 'PENDING' OR p_billing IS NOT NULL
            OR (v_payment.gateway_txn_id IS NULL AND v_payment.pricing_snapshot IS NULL) THEN
            UPDATE public.payments SET method=p_method,status='PENDING',updated_at=now(),
                amount=v_amount,currency='RON',pricing_snapshot=v_snapshot,
                billing_name=CASE WHEN p_billing IS NULL THEN billing_name ELSE p_billing->>'name' END,
                billing_email=CASE WHEN p_billing IS NULL THEN billing_email ELSE p_billing->>'email' END,
                billing_address_line1=CASE WHEN p_billing IS NULL THEN billing_address_line1 ELSE p_billing->>'addressLine1' END,
                billing_city=CASE WHEN p_billing IS NULL THEN billing_city ELSE p_billing->>'city' END,
                billing_postal_code=CASE WHEN p_billing IS NULL THEN billing_postal_code ELSE p_billing->>'postalCode' END,
                billing_country=CASE WHEN p_billing IS NULL THEN billing_country ELSE 'RO' END
            WHERE id=v_payment.id;
        END IF;
        IF v_amount = 0 THEN
            UPDATE public.enrollments SET status = 'ACTIVE' WHERE id = v_enrollment.id;
            UPDATE public.payments SET status = 'SUCCEEDED', paid_at = COALESCE(paid_at, now()), updated_at = now()
                WHERE enrollment_id = v_enrollment.id AND amount = 0 AND status = 'PENDING';
        END IF;
        v_ids := v_ids || jsonb_build_array(v_enrollment.id);
        v_price_row := jsonb_build_object('amount',v_amount,'currency','RON');
        IF v_child_id IS NOT NULL THEN v_price_row := v_price_row || jsonb_build_object('childId',v_child_id); END IF;
        IF v_adult_id IS NOT NULL THEN v_price_row := v_price_row || jsonb_build_object('adultProfileId',v_adult_id); END IF;
        v_prices := v_prices || jsonb_build_array(v_price_row);
    END LOOP;
    SELECT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_quotes) q WHERE COALESCE((q->>'amount')::BIGINT, 0) > 0
    ) INTO v_needs_card;
    RETURN jsonb_build_object('enrollmentId',v_ids->>0,'enrollmentIds',v_ids,'createdEnrollmentIds',v_created,
        'prices',v_prices,'requiresPaymentIntent',p_method='CARD' AND v_needs_card);
END;
$$;

REVOKE ALL ON FUNCTION public.save_enrollment_batch(UUID,TEXT,UUID,TEXT,JSONB,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_enrollment_batch(UUID,TEXT,UUID,TEXT,JSONB,JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.start_course_renewal(
    p_parent_id UUID,
    p_enrollment_id UUID,
    p_method TEXT,
    p_quote JSONB,
    p_billing JSONB,
    p_acceptance JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_enrollment public.enrollments;
    v_child public.children;
    v_course public.courses;
    v_open public.payments;
    v_snapshot JSONB;
    v_amount BIGINT;
    v_payment_id UUID;
    v_reused BOOLEAN := false;
    v_replaced BOOLEAN := false;
    v_started BOOLEAN := false;
    v_has_open BOOLEAN := false;
BEGIN
    IF p_parent_id IS NULL OR p_enrollment_id IS NULL
        OR p_method IS NULL OR p_method NOT IN ('CARD', 'CASH')
        OR jsonb_typeof(p_quote) IS DISTINCT FROM 'object'
        OR jsonb_typeof(p_acceptance) IS DISTINCT FROM 'object'
        OR (p_billing IS NOT NULL AND jsonb_typeof(p_billing) IS DISTINCT FROM 'object')
        OR (p_method = 'CARD' AND p_billing IS NULL) THEN
        RAISE EXCEPTION 'Cererea de reînnoire nu este validă.' USING ERRCODE = '22023', DETAIL = 'RENEWAL_REFUSED';
    END IF;
    PERFORM 1 FROM public.profiles WHERE id = p_parent_id AND role = 'PARENT' FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Doar părinții pot cumpăra ședințe.' USING ERRCODE = '42501', DETAIL = 'RENEWAL_REFUSED';
    END IF;

    SELECT * INTO v_enrollment FROM public.enrollments WHERE id = p_enrollment_id FOR UPDATE;
    IF NOT FOUND OR v_enrollment.kind IS DISTINCT FROM 'COURSE' OR v_enrollment.child_id IS NULL THEN
        RAISE EXCEPTION 'Înscrierea nu a fost găsită.' USING ERRCODE = 'P0002', DETAIL = 'RENEWAL_REFUSED';
    END IF;
    SELECT * INTO v_child FROM public.children WHERE id = v_enrollment.child_id FOR SHARE;
    IF NOT FOUND OR v_child.parent_id IS DISTINCT FROM p_parent_id THEN
        RAISE EXCEPTION 'Copilul nu îți aparține.' USING ERRCODE = '42501', DETAIL = 'RENEWAL_REFUSED';
    END IF;
    IF v_enrollment.status IS DISTINCT FROM 'ACTIVE' THEN
        RAISE EXCEPTION 'Poți cumpăra ședințe noi doar la o înscriere activă.' USING ERRCODE = '23514', DETAIL = 'RENEWAL_REFUSED';
    END IF;

    SELECT * INTO v_course FROM public.courses WHERE id = v_enrollment.entity_id FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Oferta nu a fost găsită.' USING ERRCODE = 'P0002', DETAIL = 'RENEWAL_REFUSED';
    END IF;
    IF v_course.active IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Oferta nu mai este activă.' USING ERRCODE = '23514', DETAIL = 'RENEWAL_REFUSED';
    END IF;
    IF NOT public.enrollment_offer_has_access('COURSE', v_course.id) THEN
        RAISE EXCEPTION 'Această ofertă nu primește înscrieri momentan.'
            USING ERRCODE = '23514', DETAIL = 'SUBSCRIPTION_INACTIVE';
    END IF;

    v_snapshot := nullif(p_quote->'snapshot', 'null'::JSONB);
    v_amount := (p_quote->>'amount')::BIGINT;
    IF v_snapshot IS NULL OR v_amount IS NULL OR v_amount <= 0 OR v_amount > 9007199254740991
        OR p_quote->>'currency' IS DISTINCT FROM 'RON'
        OR public.valid_enrollment_price_snapshot(v_snapshot, v_amount, 'RON') IS DISTINCT FROM true
        OR v_snapshot->>'kind' IS DISTINCT FROM 'COURSE'
        OR v_snapshot->>'entityId' IS DISTINCT FROM v_course.id::TEXT
        OR v_snapshot->>'childId' IS DISTINCT FROM v_enrollment.child_id::TEXT
        OR v_snapshot ? 'adultProfileId'
        OR v_snapshot->>'priceVersion' IS DISTINCT FROM p_quote->>'priceVersion' THEN
        RAISE EXCEPTION 'Oferta confirmată nu este validă.' USING ERRCODE = '23514', DETAIL = 'RENEWAL_REFUSED';
    END IF;
    IF public.course_quote_matches_offer(v_course.id, v_snapshot) IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Prețul s-a schimbat. Revino la Detalii și confirmă suma.'
            USING ERRCODE = '23514', DETAIL = 'PRICE_CHANGED';
    END IF;

    IF (v_snapshot->>'quantity')::NUMERIC > 100 THEN
        RAISE EXCEPTION 'Poți cumpăra cel mult 100 de ședințe odată.'
            USING ERRCODE = '22023', DETAIL = 'RENEWAL_REFUSED';
    END IF;

    PERFORM 1 FROM public.payments WHERE enrollment_id = v_enrollment.id ORDER BY id FOR UPDATE;
    SELECT * INTO v_open FROM public.payments
    WHERE enrollment_id = v_enrollment.id AND status IN ('PENDING', 'FAILED');
    v_has_open := FOUND;
    IF v_has_open THEN
        v_started := v_open.gateway_txn_id IS NOT NULL
            OR EXISTS (SELECT 1 FROM public.payment_intent_requests WHERE id = v_open.id);
    END IF;
    IF v_has_open AND v_started THEN
        IF v_open.amount IS DISTINCT FROM v_amount OR v_open.currency IS DISTINCT FROM 'RON'
            OR v_open.pricing_snapshot IS DISTINCT FROM v_snapshot
            OR v_open.method IS DISTINCT FROM p_method THEN
            RAISE EXCEPTION 'Ai o plată cu cardul începută la acest curs. Finalizeaz-o din Înscrieri.'
                USING ERRCODE = '23514', DETAIL = 'RENEWAL_IN_PROGRESS';
        END IF;
        v_payment_id := v_open.id;
        v_reused := true;
    ELSIF v_has_open AND v_open.status = 'PENDING' AND v_open.method = p_method
        AND v_open.amount = v_amount AND v_open.currency = 'RON'
        AND v_open.pricing_snapshot = v_snapshot THEN
        IF p_method = 'CARD' THEN
            UPDATE public.payments SET updated_at = now(),
                billing_name = p_billing->>'name',
                billing_email = p_billing->>'email',
                billing_address_line1 = p_billing->>'addressLine1',
                billing_city = p_billing->>'city',
                billing_postal_code = p_billing->>'postalCode',
                billing_country = 'RO'
            WHERE id = v_open.id;
        END IF;
        v_payment_id := v_open.id;
        v_reused := true;
    ELSE
        IF v_has_open THEN
            DELETE FROM public.payments WHERE id = v_open.id;
            v_replaced := true;
        END IF;
        INSERT INTO public.payments(enrollment_id, method, amount, currency, pricing_snapshot, status,
            billing_name, billing_email, billing_address_line1, billing_city, billing_postal_code, billing_country)
        VALUES (v_enrollment.id, p_method, v_amount, 'RON', v_snapshot, 'PENDING',
            CASE WHEN p_method = 'CARD' THEN p_billing->>'name' END,
            CASE WHEN p_method = 'CARD' THEN p_billing->>'email' END,
            CASE WHEN p_method = 'CARD' THEN p_billing->>'addressLine1' END,
            CASE WHEN p_method = 'CARD' THEN p_billing->>'city' END,
            CASE WHEN p_method = 'CARD' THEN p_billing->>'postalCode' END,
            CASE WHEN p_method = 'CARD' THEN 'RO' END)
        RETURNING id INTO v_payment_id;
    END IF;

    INSERT INTO public.checkout_acceptances (
        user_id, kind, entity_id, enrollment_ids, payment_method,
        terms_version, terms_sha256, client_terms_version,
        rules_source, rules_file_path, rules_file_name, rules_sha256
    ) VALUES (
        p_parent_id, 'COURSE', v_course.id, ARRAY[v_enrollment.id], p_method,
        p_acceptance->>'termsVersion',
        p_acceptance->>'termsSha256',
        p_acceptance->>'clientTermsVersion',
        p_acceptance->>'rulesSource',
        p_acceptance->>'rulesFilePath',
        p_acceptance->>'rulesFileName',
        p_acceptance->>'rulesSha256'
    );

    RETURN jsonb_build_object(
        'enrollmentId', v_enrollment.id,
        'enrollmentIds', jsonb_build_array(v_enrollment.id),
        'paymentId', v_payment_id,
        'sessions', (v_snapshot->>'quantity')::INTEGER,
        'reused', v_reused,
        'replaced', v_replaced,
        'prices', jsonb_build_array(jsonb_build_object(
            'childId', v_enrollment.child_id, 'amount', v_amount, 'currency', 'RON')),
        'requiresPaymentIntent', p_method = 'CARD'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.start_course_renewal(UUID, UUID, TEXT, JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_course_renewal(UUID, UUID, TEXT, JSONB, JSONB, JSONB) TO service_role;
