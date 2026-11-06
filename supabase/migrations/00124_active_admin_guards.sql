-- Bug #1340: the admin subscription and payment lists checked only
-- profiles.role through get_my_role(). An ADMIN account that was disabled
-- (enabled = false) or deleted (deleted_at set) but still held a valid JWT or
-- refresh token could keep reading every subscription and payment.
-- private.caller_is_active_admin() requires role ADMIN, enabled and no
-- deleted_at, and replaces the role check in get_admin_payments() (body from
-- 00120) and get_admin_subscriptions() (body from 00122). Nothing else in the
-- two functions changes; both bodies were compared with the live md5 before
-- this migration. The edge functions admin-extend-subscription,
-- sync-subscription-prices, setup-subscription-webhook and
-- admin-refund-payment apply the same rule through getActiveUserRole().

CREATE OR REPLACE FUNCTION private.caller_is_active_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role = 'ADMIN'
          AND p.enabled
          AND p.deleted_at IS NULL
    )
$$;
REVOKE ALL ON FUNCTION private.caller_is_active_admin() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_payments(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS TABLE (
    source TEXT,
    id UUID,
    kind TEXT,
    offer_title TEXT,
    participant_name TEXT,
    is_adult BOOLEAN,
    payer_name TEXT,
    payer_email TEXT,
    receiver_name TEXT,
    method TEXT,
    card_brand TEXT,
    card_last4 TEXT,
    amount BIGINT,
    amount_refunded BIGINT,
    stripe_fee_amount BIGINT,
    currency TEXT,
    status TEXT,
    gateway_ref TEXT,
    created_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    enrollment_status TEXT,
    refunds JSONB,
    transferred BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT private.caller_is_active_admin() THEN
        RAISE EXCEPTION 'Doar administratorii văd istoricul plăților' USING ERRCODE = '42501';
    END IF;
    IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > INTERVAL '1 year 1 day' THEN
        RAISE EXCEPTION 'Intervalul trebuie să aibă cel mult un an' USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    WITH offers AS (
        SELECT 'COURSE'::TEXT AS kind, c.id, c.name AS title, c.coach_id, c.club_id FROM public.courses c
        UNION ALL
        SELECT 'ACTIVITY', a.id, a.name, a.coach_id, a.club_id FROM public.activities a
        UNION ALL
        SELECT 'CAMP', t.id, t.title, t.coach_id, t.club_id FROM public.camps t
        UNION ALL
        SELECT 'COMPETITION', m.id, m.title, m.coach_id, m.club_id FROM public.competitions m
    ),
    refund_lists AS (
        SELECT r.payment_id, r.subscription_invoice_id,
            jsonb_agg(jsonb_build_object(
                'id', r.id, 'amount', r.amount, 'status', r.status, 'reason', r.reason,
                'origin', r.origin, 'admin_name', r.admin_name, 'failure_reason', r.failure_reason,
                'cancel_enrollment', r.cancel_enrollment, 'created_at', r.created_at
            ) ORDER BY r.created_at) AS items
        FROM public.payment_refunds r
        GROUP BY r.payment_id, r.subscription_invoice_id
    )
    , history AS (
    SELECT 'PAYMENT'::TEXT AS source, payment.id, enrollment.kind, offer.title,
        COALESCE(child.name, adult.name), enrollment.child_id IS NULL,
        COALESCE(NULLIF(payment.billing_name, ''), parent.name, adult.name),
        COALESCE(NULLIF(payment.billing_email, ''), parent.email, adult.email),
        CASE WHEN payment.method = 'CARD' AND payment.stripe_destination_account IS NULL THEN 'Motion România'
            ELSE COALESCE(club.name, coach.name, 'Motion România') END,
        payment.method, payment.card_brand, payment.card_last4,
        payment.amount, payment.amount_refunded, payment.stripe_fee_amount, payment.currency,
        payment.status, payment.gateway_txn_id, payment.created_at, payment.paid_at,
        enrollment.status, COALESCE(refund.items, '[]'::JSONB), payment.stripe_destination_account IS NOT NULL
    FROM public.payments payment
    JOIN public.enrollments enrollment ON enrollment.id = payment.enrollment_id
    LEFT JOIN offers offer ON offer.kind = enrollment.kind AND offer.id = enrollment.entity_id
    LEFT JOIN public.clubs club ON club.id = offer.club_id
    LEFT JOIN public.profiles coach ON coach.id = offer.coach_id
    LEFT JOIN public.children child ON child.id = enrollment.child_id
    LEFT JOIN public.profiles parent ON parent.id = child.parent_id
    LEFT JOIN public.profiles adult ON adult.id = enrollment.adult_profile_id
    LEFT JOIN refund_lists refund ON refund.payment_id = payment.id
    WHERE COALESCE(payment.paid_at, payment.created_at) >= p_from
      AND COALESCE(payment.paid_at, payment.created_at) < p_to
    UNION ALL
    SELECT 'SUBSCRIPTION_INVOICE'::TEXT, invoice.id, invoice.subscriber_type,
        COALESCE(plan.name, invoice.plan_code, 'Abonament'), NULL::TEXT, false,
        COALESCE(sub_club.name, sub_coach.name, invoice.subscriber_name, invoice.billing_name),
        COALESCE(invoice.billing_email, sub_club.email, sub_coach.email),
        'Motion România'::TEXT, 'CARD'::TEXT, invoice.card_brand, invoice.card_last4,
        invoice.amount, invoice.amount_refunded, NULL::BIGINT, invoice.currency,
        CASE invoice.status WHEN 'PAID' THEN 'SUCCEEDED' ELSE invoice.status END,
        invoice.stripe_invoice_id, invoice.created_at, invoice.paid_at, NULL::TEXT,
        COALESCE(refund.items, '[]'::JSONB), false
    FROM public.subscription_invoices invoice
    LEFT JOIN public.subscriptions sub ON sub.id = invoice.subscription_id
    LEFT JOIN public.clubs sub_club ON sub_club.id = sub.club_id
    LEFT JOIN public.profiles sub_coach ON sub_coach.id = sub.coach_user_id
    LEFT JOIN public.subscription_plans plan
        ON plan.code = invoice.plan_code AND plan.subscriber_type = invoice.subscriber_type
    LEFT JOIN refund_lists refund ON refund.subscription_invoice_id = invoice.id
    WHERE COALESCE(invoice.paid_at, invoice.created_at) >= p_from
      AND COALESCE(invoice.paid_at, invoice.created_at) < p_to
    )
    SELECT h.* FROM history h
    ORDER BY COALESCE(h.paid_at, h.created_at) DESC, h.id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_admin_payments(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_payments(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_subscriptions()
RETURNS TABLE (
    id UUID,
    subscriber_type TEXT,
    subscriber_name TEXT,
    subscriber_email TEXT,
    plan_code TEXT,
    plan_name TEXT,
    price_bani INTEGER,
    scheduled_plan_name TEXT,
    status TEXT,
    trial_end TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    access_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN,
    has_stripe_subscription BOOLEAN,
    coach_count INTEGER,
    created_at TIMESTAMPTZ,
    adjustments JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT private.caller_is_active_admin() THEN
        RAISE EXCEPTION 'Doar administratorii văd abonamentele' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        s.id,
        s.subscriber_type,
        COALESCE(club.name, coach.name, 'Cont șters'),
        COALESCE(club.email, coach.email),
        s.plan_code,
        plan.name,
        plan.price_bani,
        scheduled.name,
        s.status,
        s.trial_end,
        s.current_period_end,
        private.subscription_access_end(s.id),
        s.cancel_at_period_end,
        s.stripe_subscription_id IS NOT NULL,
        CASE WHEN s.club_id IS NULL THEN NULL ELSE (
            SELECT count(*)::INTEGER FROM public.club_coaches cc WHERE cc.club_id = s.club_id
        ) END,
        s.created_at,
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', adj.id,
                'days', adj.days,
                'reason', adj.reason,
                'admin_name', admin.name,
                'created_at', adj.created_at
            ) ORDER BY adj.created_at DESC)
            FROM public.subscription_adjustments adj
            LEFT JOIN public.profiles admin ON admin.id = adj.admin_user_id
            WHERE adj.subscription_id = s.id
        ), '[]'::jsonb)
    FROM public.subscriptions s
    LEFT JOIN public.clubs club ON club.id = s.club_id
    LEFT JOIN public.profiles coach ON coach.id = s.coach_user_id
    LEFT JOIN public.subscription_plans plan
        ON plan.code = s.plan_code AND plan.subscriber_type = s.subscriber_type
    LEFT JOIN public.subscription_plans scheduled
        ON scheduled.code = s.scheduled_plan_code AND scheduled.subscriber_type = s.subscriber_type
    ORDER BY s.created_at DESC, s.id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_admin_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_subscriptions() TO authenticated;
