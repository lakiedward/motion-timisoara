CREATE FUNCTION public.cancel_unaccepted_enrollment_draft(p_enrollment_id UUID, p_parent_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_enrollment public.enrollments;
BEGIN
    SELECT * INTO v_enrollment FROM public.enrollments WHERE id = p_enrollment_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('cancelled', false, 'reason', 'not_found'); END IF;
    IF NOT EXISTS (SELECT FROM public.children WHERE id = v_enrollment.child_id AND parent_id = p_parent_id) THEN
        RETURN jsonb_build_object('cancelled', false, 'reason', 'not_owner');
    END IF;
    IF v_enrollment.status <> 'PENDING' THEN
        RETURN jsonb_build_object('cancelled', false, 'reason', 'status_' || v_enrollment.status);
    END IF;
    PERFORM 1 FROM public.payments WHERE enrollment_id = p_enrollment_id ORDER BY id FOR UPDATE;
    IF EXISTS (SELECT FROM public.payments WHERE enrollment_id = p_enrollment_id
        AND (pricing_snapshot IS NOT NULL OR gateway_txn_id IS NOT NULL OR status NOT IN ('PENDING', 'FAILED'))) THEN
        RETURN jsonb_build_object('cancelled', false, 'reason', 'payment_retained_for_retry');
    END IF;
    DELETE FROM public.payments WHERE enrollment_id = p_enrollment_id;
    DELETE FROM public.enrollments WHERE id = p_enrollment_id;
    RETURN jsonb_build_object('cancelled', true);
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_unaccepted_enrollment_draft(UUID, UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_unaccepted_enrollment_draft(UUID, UUID) TO service_role;
