CREATE TABLE public.payment_intent_requests (
    id UUID PRIMARY KEY REFERENCES public.payments(id) ON DELETE CASCADE,
    params JSONB NOT NULL CHECK (jsonb_typeof(params) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_intent_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_intent_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.payment_intent_requests TO service_role;

CREATE FUNCTION public.freeze_payment_intent_request(p_payment_id UUID, p_params JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_payment public.payments;
    v_request public.payment_intent_requests;
BEGIN
    SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND OR v_payment.method <> 'CARD' OR v_payment.currency <> 'RON'
        OR v_payment.status NOT IN ('PENDING', 'FAILED') OR v_payment.gateway_txn_id IS NOT NULL THEN
        RAISE EXCEPTION 'Payment cannot prepare a new intent' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO v_request FROM public.payment_intent_requests WHERE id = p_payment_id;
    IF FOUND THEN
        IF v_request.created_at < now() - interval '23 hours' THEN
            RAISE EXCEPTION 'Unbound Stripe request requires reconciliation' USING ERRCODE = '23514';
        END IF;
        RETURN v_request.params;
    END IF;
    IF jsonb_typeof(p_params) IS DISTINCT FROM 'object'
        OR p_params->>'currency' IS DISTINCT FROM 'ron'
        OR p_params->>'amount' IS DISTINCT FROM v_payment.amount::TEXT
        OR p_params->'metadata'->>'paymentId' IS DISTINCT FROM v_payment.id::TEXT
        OR p_params->'metadata'->>'enrollmentId' IS DISTINCT FROM v_payment.enrollment_id::TEXT THEN
        RAISE EXCEPTION 'Intent request does not match payment' USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.payment_intent_requests(id, params) VALUES (p_payment_id, p_params);
    RETURN p_params;
END;
$$;
REVOKE ALL ON FUNCTION public.freeze_payment_intent_request(UUID, JSONB) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.freeze_payment_intent_request(UUID, JSONB) TO service_role;
