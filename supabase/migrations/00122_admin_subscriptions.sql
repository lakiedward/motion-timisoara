-- Feature #620: admin panel for coach and club subscriptions.
--
-- get_admin_subscriptions() lists every subscription with the subscriber, the
-- plan, the date access ends and the logged free extensions; only ADMIN can
-- call it. A free extension is a two step server flow used by the
-- admin-extend-subscription edge function: begin_subscription_extension()
-- computes the new end date (the later of the current access end and now, plus
-- the days), the function moves the Stripe trial end when the subscription is
-- live there, and apply_subscription_extension() stores the new trial end and
-- logs the days and the reason in subscription_adjustments. Both extension
-- functions are executable by service_role only.

CREATE OR REPLACE FUNCTION private.subscription_access_end(p_subscription_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT CASE s.status
        WHEN 'trialing' THEN COALESCE(
            s.trial_end,
            st.launch_at + make_interval(days => st.launch_trial_days)
        )
        WHEN 'active' THEN s.current_period_end + interval '1 day'
        WHEN 'past_due' THEN s.past_due_since + interval '7 days'
        WHEN 'canceled' THEN s.current_period_end
        ELSE NULL
    END
    FROM public.subscriptions s
    CROSS JOIN public.subscription_settings st
    WHERE s.id = p_subscription_id
      AND st.singleton
$$;
REVOKE ALL ON FUNCTION private.subscription_access_end(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.subscription_access_end(UUID) TO service_role;

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
    IF (SELECT auth.uid()) IS NULL OR (SELECT public.get_my_role()) IS DISTINCT FROM 'ADMIN' THEN
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

CREATE OR REPLACE FUNCTION public.begin_subscription_extension(
    p_subscription_id UUID,
    p_days INTEGER
)
RETURNS TABLE (
    status TEXT,
    previous_end TIMESTAMPTZ,
    new_end TIMESTAMPTZ,
    stripe_subscription_id TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_row public.subscriptions%ROWTYPE;
    v_end TIMESTAMPTZ;
BEGIN
    IF p_days IS NULL OR p_days < 1 OR p_days > 366 THEN
        RAISE EXCEPTION 'INVALID_DAYS' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_row FROM public.subscriptions s WHERE s.id = p_subscription_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    v_end := private.subscription_access_end(v_row.id);
    IF v_end IS NULL AND v_row.status = 'trialing' THEN
        RAISE EXCEPTION 'NO_END_DATE' USING ERRCODE = '22023';
    END IF;

    RETURN QUERY SELECT
        v_row.status,
        v_end,
        GREATEST(COALESCE(v_end, now()), now()) + make_interval(days => p_days),
        v_row.stripe_subscription_id;
END;
$$;
REVOKE ALL ON FUNCTION public.begin_subscription_extension(UUID, INTEGER)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_subscription_extension(UUID, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_subscription_extension(
    p_subscription_id UUID,
    p_admin_user_id UUID,
    p_days INTEGER,
    p_reason TEXT,
    p_new_end TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_adjustment_id UUID;
BEGIN
    IF p_new_end IS NULL OR p_new_end <= now() OR p_new_end > now() + interval '800 days' THEN
        RAISE EXCEPTION 'INVALID_END' USING ERRCODE = '22023';
    END IF;
    PERFORM 1 FROM public.subscriptions s WHERE s.id = p_subscription_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.subscription_adjustments (subscription_id, admin_user_id, days, reason)
    VALUES (p_subscription_id, p_admin_user_id, p_days, p_reason)
    RETURNING public.subscription_adjustments.id INTO v_adjustment_id;

    UPDATE public.subscriptions s
    SET status = 'trialing',
        trial_end = p_new_end,
        past_due_since = NULL
    WHERE s.id = p_subscription_id;

    RETURN v_adjustment_id;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_subscription_extension(UUID, UUID, INTEGER, TEXT, TIMESTAMPTZ)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription_extension(UUID, UUID, INTEGER, TEXT, TIMESTAMPTZ)
    TO service_role;
