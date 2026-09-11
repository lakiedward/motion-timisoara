CREATE FUNCTION public.apply_enrollment_payment_result(
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
    IF v_payment.pricing_snapshot IS NOT NULL AND (
        v_payment.pricing_snapshot->>'kind' IS DISTINCT FROM v_enrollment.kind
        OR v_payment.pricing_snapshot->>'entityId' IS DISTINCT FROM v_enrollment.entity_id::TEXT
        OR v_payment.pricing_snapshot->>'childId' IS DISTINCT FROM v_enrollment.child_id::TEXT
    ) THEN
        RAISE EXCEPTION 'Accepted price does not match enrollment' USING ERRCODE = '23514';
    END IF;
    IF v_enrollment.kind = 'COURSE' THEN
        IF v_payment.pricing_snapshot IS NULL THEN
            RAISE EXCEPTION 'Legacy course payment requires verified session quantity' USING ERRCODE = '23514';
        END IF;
        v_sessions := (v_payment.pricing_snapshot->>'quantity')::INTEGER;
    END IF;

    UPDATE public.enrollments SET status = 'ACTIVE',
        purchased_sessions = purchased_sessions + v_sessions,
        remaining_sessions = remaining_sessions + v_sessions
    WHERE id = v_enrollment.id;
    UPDATE public.payments SET status = 'SUCCEEDED', paid_at = now(), updated_at = now()
    WHERE id = p_payment_id;

    RETURN jsonb_build_object('changed', true, 'status', 'SUCCEEDED',
        'enrollmentId', v_enrollment.id, 'sessionsAdded', v_sessions);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_enrollment_payment_result(UUID, TEXT, BIGINT, TEXT, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_enrollment_payment_result(UUID, TEXT, BIGINT, TEXT, TEXT, TEXT)
    TO service_role;
