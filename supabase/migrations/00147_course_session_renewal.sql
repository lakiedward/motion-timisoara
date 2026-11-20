-- Feature #695: a parent buys more sessions for a course where the child
-- already has an ACTIVE enrollment ("reînnoire"). Every purchase is its own
-- payments row on the same enrollment, with its own accepted price snapshot;
-- apply_enrollment_payment_result() already adds the snapshot quantity to
-- purchased_sessions / remaining_sessions when the payment is confirmed (card
-- through Stripe, cash by the coach or club), so it is unchanged here.
--
-- At most one open payment (PENDING or FAILED) per enrollment: the open one is
-- the payment the parent resumes and the one card checkout charges. Accepted
-- pricing stays immutable (guard_enrollment_price_snapshot): an open renewal
-- that Stripe has not started is replaced (deleted and inserted again) when the
-- parent picks another package or method; once Stripe has a session or intent
-- for it, it can only be resumed. No sessions are added before confirmation,
-- so deleting an unstarted open payment loses nothing. Later
-- package work (#697 coach-defined packages, #698 monthly validity) builds on
-- the same rule: one payments row = one purchased package.
--
-- start_course_renewal() is called only by the create-enrollment edge function
-- (service_role), in one transaction with the checkout acceptance record.

CREATE UNIQUE INDEX payments_one_open_per_enrollment
    ON public.payments (enrollment_id)
    WHERE status IN ('PENDING', 'FAILED');

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
    IF to_jsonb(v_course.price_per_session) IS DISTINCT FROM v_snapshot->'sourceUnitAmount'
        OR to_jsonb(v_course.currency) IS DISTINCT FROM v_snapshot->'sourceCurrency'
        OR coalesce(to_jsonb(v_course.eur_ron_rate_micros), 'null'::JSONB) IS DISTINCT FROM v_snapshot->'eurRonRateMicros' THEN
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
