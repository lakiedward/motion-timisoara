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
    v_count INTEGER;
    v_occupied INTEGER;
    v_amount BIGINT;
    v_source JSONB;
    v_ids JSONB := '[]'::JSONB;
    v_created JSONB := '[]'::JSONB;
    v_prices JSONB := '[]'::JSONB;
    v_exists BOOLEAN;
    v_needs_card BOOLEAN;
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
    IF (SELECT count(DISTINCT q->>'childId') FROM jsonb_array_elements(p_quotes) q) <> jsonb_array_length(p_quotes) THEN
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

    FOR v_quote IN SELECT q FROM jsonb_array_elements(p_quotes) q ORDER BY q->>'childId'
    LOOP
        v_child_id := (v_quote->>'childId')::UUID;
        v_amount := (v_quote->>'amount')::BIGINT;
        v_snapshot := nullif(v_quote->'snapshot', 'null'::JSONB);
        IF v_amount IS NULL OR v_amount < 0 OR v_amount > 9007199254740991
            OR v_quote->>'currency' IS DISTINCT FROM 'RON'
            OR public.valid_enrollment_price_snapshot(v_snapshot, v_amount, 'RON') IS DISTINCT FROM true
            OR (v_snapshot IS NOT NULL AND (
                v_snapshot->>'kind' IS DISTINCT FROM p_kind
                OR v_snapshot->>'entityId' IS DISTINCT FROM p_entity_id::TEXT
                OR v_snapshot->>'childId' IS DISTINCT FROM v_child_id::TEXT
                OR v_snapshot->>'priceVersion' IS DISTINCT FROM v_quote->>'priceVersion')) THEN
            RAISE EXCEPTION 'Oferta confirmată nu este validă.' USING ERRCODE = '23514';
        END IF;
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
                v_prices := v_prices || jsonb_build_array(jsonb_build_object('childId',v_child_id,'amount',v_amount,'currency','RON'));
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
            IF p_kind = 'CAMP' THEN
                v_source := public.enrollment_camp_offer(p_entity_id, v_child_id);
            ELSE
                v_source := jsonb_build_object('amount', CASE WHEN p_kind = 'COURSE' THEN v_offer->'price_per_session' ELSE v_offer->'price' END,
                    'currency',v_offer->'currency','eur_ron_rate_micros',v_offer->'eur_ron_rate_micros');
            END IF;
            IF v_source->'amount' IS DISTINCT FROM v_snapshot->'sourceUnitAmount'
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
            INSERT INTO public.enrollments(kind,entity_id,child_id,status,purchased_sessions,remaining_sessions,sessions_used)
                VALUES(p_kind,p_entity_id,v_child_id,'PENDING',0,0,0) RETURNING * INTO v_enrollment;
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
        v_prices := v_prices || jsonb_build_array(jsonb_build_object('childId',v_child_id,'amount',v_amount,'currency','RON'));
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
