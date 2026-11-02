-- Feature #610: schema for coach and club subscriptions (spec
-- docs/superpowers/specs/2026-11-02-abonamente-antrenori-cluburi.md).
--
-- subscription_plans holds the four plans (prices in bani, coach limits and,
-- later, the Stripe price ids). subscription_settings is a single row whose
-- launch_at stays NULL until the owner launches: while it is NULL every access
-- check returns true, so nothing is enforced. subscriptions has one row per
-- independent coach account or club. subscription_events records each Stripe
-- webhook event once; subscription_adjustments logs admin free extensions.
--
-- Clients only read: everybody reads plans and settings, a coach reads their
-- own subscription, a club owner their club's, ADMIN reads all subscriptions
-- and adjustments. Every write goes through edge functions with the service
-- role. Access is computed from dates at read time by
-- subscriber_has_access(), offer_has_access() (the owner of the offer pays)
-- and coach_has_access() (own access or a club with access covers the coach).

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z_]{1,31}$'),
    subscriber_type TEXT NOT NULL CHECK (subscriber_type IN ('COACH', 'CLUB')),
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    price_bani INTEGER NOT NULL CHECK (price_bani > 0),
    coach_limit INTEGER CHECK (coach_limit > 0),
    stripe_price_id TEXT UNIQUE CHECK (stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT subscription_plans_code_type_key UNIQUE (code, subscriber_type),
    CONSTRAINT subscription_plans_coach_limit_ck CHECK (subscriber_type = 'CLUB' OR coach_limit IS NULL)
);

INSERT INTO public.subscription_plans (code, subscriber_type, name, price_bani, coach_limit) VALUES
    ('COACH', 'COACH', 'Antrenor', 10000, NULL),
    ('CLUB_START', 'CLUB', 'Club Start', 19900, 3),
    ('CLUB', 'CLUB', 'Club', 34900, 10),
    ('CLUB_PRO', 'CLUB', 'Club Pro', 59900, NULL);

CREATE TABLE public.subscription_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    singleton BOOLEAN NOT NULL DEFAULT true UNIQUE CHECK (singleton),
    launch_at TIMESTAMPTZ,
    launch_trial_days INTEGER NOT NULL DEFAULT 90 CHECK (launch_trial_days BETWEEN 1 AND 366),
    signup_trial_days INTEGER NOT NULL DEFAULT 30 CHECK (signup_trial_days BETWEEN 1 AND 366),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.subscription_settings (launch_at, launch_trial_days, signup_trial_days) VALUES (NULL, 90, 30);

CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_type TEXT NOT NULL CHECK (subscriber_type IN ('COACH', 'CLUB')),
    coach_user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    club_id UUID UNIQUE REFERENCES public.clubs(id) ON DELETE CASCADE,
    plan_code TEXT,
    scheduled_plan_code TEXT,
    status TEXT NOT NULL DEFAULT 'trialing'
        CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'expired')),
    trial_end TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    past_due_since TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    stripe_customer_id TEXT UNIQUE CHECK (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
    stripe_subscription_id TEXT UNIQUE CHECK (stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
    terms_version TEXT CHECK (char_length(terms_version) BETWEEN 1 AND 20),
    terms_accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT subscriptions_subscriber_ck CHECK (
        (subscriber_type = 'COACH' AND coach_user_id IS NOT NULL AND club_id IS NULL)
        OR (subscriber_type = 'CLUB' AND club_id IS NOT NULL AND coach_user_id IS NULL)
    ),
    CONSTRAINT subscriptions_plan_fk FOREIGN KEY (plan_code, subscriber_type)
        REFERENCES public.subscription_plans (code, subscriber_type) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT subscriptions_scheduled_plan_fk FOREIGN KEY (scheduled_plan_code, subscriber_type)
        REFERENCES public.subscription_plans (code, subscriber_type) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT subscriptions_terms_ck CHECK ((terms_version IS NULL) = (terms_accepted_at IS NULL))
);
CREATE INDEX subscriptions_status_idx ON public.subscriptions(status);

CREATE TABLE public.subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT NOT NULL UNIQUE CHECK (stripe_event_id ~ '^evt_[A-Za-z0-9]+$'),
    type TEXT NOT NULL CHECK (char_length(type) BETWEEN 1 AND 100),
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    error TEXT CHECK (char_length(error) <= 2000)
);

CREATE TABLE public.subscription_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    admin_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    days INTEGER NOT NULL CHECK (days BETWEEN 1 AND 366),
    reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX subscription_adjustments_subscription_idx
    ON public.subscription_adjustments(subscription_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.subscriptions_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.subscriptions_set_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER subscriptions_set_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.subscriptions_set_updated_at();
CREATE TRIGGER subscription_settings_set_updated_at
    BEFORE UPDATE ON public.subscription_settings
    FOR EACH ROW EXECUTE FUNCTION public.subscriptions_set_updated_at();

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_adjustments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.subscription_plans, public.subscription_settings, public.subscriptions,
    public.subscription_events, public.subscription_adjustments
    FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT SELECT ON public.subscription_settings TO anon, authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT ON public.subscription_adjustments TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.subscription_plans TO service_role;
GRANT SELECT, UPDATE ON public.subscription_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.subscription_events TO service_role;
GRANT SELECT, INSERT ON public.subscription_adjustments TO service_role;

CREATE POLICY subscription_plans_select ON public.subscription_plans
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY subscription_settings_select ON public.subscription_settings
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY subscriptions_select ON public.subscriptions
    FOR SELECT TO authenticated
    USING (
        coach_user_id = (SELECT auth.uid())
        OR club_id IN (SELECT public.my_club_ids())
        OR (SELECT public.get_my_role()) = 'ADMIN'
    );

CREATE POLICY subscription_adjustments_select ON public.subscription_adjustments
    FOR SELECT TO authenticated
    USING ((SELECT public.get_my_role()) = 'ADMIN');

CREATE OR REPLACE FUNCTION private.subscriber_has_access_at(
    p_club_id UUID,
    p_coach_user_id UUID,
    p_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    WITH settings AS (
        SELECT st.launch_at, st.launch_trial_days
        FROM public.subscription_settings st
        WHERE st.singleton
    )
    SELECT CASE
        WHEN (p_club_id IS NULL) = (p_coach_user_id IS NULL) THEN false
        WHEN NOT EXISTS (SELECT 1 FROM settings WHERE launch_at IS NOT NULL) THEN true
        ELSE COALESCE((
            SELECT CASE s.status
                WHEN 'trialing' THEN p_at < COALESCE(
                    s.trial_end,
                    st.launch_at + make_interval(days => st.launch_trial_days)
                )
                WHEN 'active' THEN p_at < s.current_period_end + interval '1 day'
                WHEN 'past_due' THEN p_at < s.past_due_since + interval '7 days'
                WHEN 'canceled' THEN p_at < s.current_period_end
                ELSE false
            END
            FROM public.subscriptions s
            CROSS JOIN settings st
            WHERE (p_club_id IS NOT NULL AND s.club_id = p_club_id)
               OR (p_coach_user_id IS NOT NULL AND s.coach_user_id = p_coach_user_id)
        ), false)
    END
$$;
REVOKE ALL ON FUNCTION private.subscriber_has_access_at(UUID, UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.subscriber_has_access_at(UUID, UUID, TIMESTAMPTZ) TO service_role;

CREATE OR REPLACE FUNCTION private.coach_has_access_at(p_coach_user_id UUID, p_at TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p_coach_user_id IS NOT NULL AND (
        private.subscriber_has_access_at(NULL, p_coach_user_id, p_at)
        OR EXISTS (
            SELECT 1
            FROM public.club_coaches cc
            JOIN public.coach_profiles cp ON cp.id = cc.coach_profile_id
            WHERE cp.user_id = p_coach_user_id
              AND private.subscriber_has_access_at(cc.club_id, NULL, p_at)
        )
    )
$$;
REVOKE ALL ON FUNCTION private.coach_has_access_at(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.coach_has_access_at(UUID, TIMESTAMPTZ) TO service_role;

CREATE OR REPLACE FUNCTION public.subscriber_has_access(p_club_id UUID, p_coach_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT private.subscriber_has_access_at(p_club_id, p_coach_user_id, now())
$$;

CREATE OR REPLACE FUNCTION public.offer_has_access(p_club_id UUID, p_coach_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT CASE
        WHEN p_club_id IS NOT NULL THEN private.subscriber_has_access_at(p_club_id, NULL, now())
        WHEN p_coach_id IS NOT NULL THEN private.subscriber_has_access_at(NULL, p_coach_id, now())
        ELSE true
    END
$$;

CREATE OR REPLACE FUNCTION public.coach_has_access(p_coach_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT private.coach_has_access_at(p_coach_user_id, now())
$$;

REVOKE ALL ON FUNCTION public.subscriber_has_access(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.offer_has_access(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coach_has_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subscriber_has_access(UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.offer_has_access(UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.coach_has_access(UUID) TO anon, authenticated, service_role;
