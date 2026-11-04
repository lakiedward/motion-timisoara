-- Feature #616: free period rows (spec section "Free period").
--
-- Every subscriber must have exactly one subscriptions row before the owner
-- sets launch_at, because after launch a subscriber without a row has no
-- access. This migration:
--   * creates a trialing row automatically when a coach profile is created and
--     when a club is approved (inserted already approved, or approved later);
--   * backfills a trialing row for every existing coach profile and approved
--     club that has none, always with the launch promotion (trial_end NULL),
--     because these accounts exist before the launch.
-- Before launch the row stores trial_end NULL, meaning the launch promotion
-- (launch_at + launch_trial_days, 90 days). After launch a new row stores a
-- concrete trial_end = now() + signup_trial_days (30 days). Existing rows are
-- never changed (ON CONFLICT DO NOTHING), so subscriptions already created by
-- Checkout or the webhook keep their state.

CREATE OR REPLACE FUNCTION private.new_subscription_trial_end()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT CASE WHEN st.launch_at IS NULL THEN NULL
                ELSE now() + make_interval(days => st.signup_trial_days) END
    FROM public.subscription_settings st
    WHERE st.singleton
$$;
REVOKE ALL ON FUNCTION private.new_subscription_trial_end() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_coach_subscription_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.subscriptions (subscriber_type, coach_user_id, status, trial_end)
    VALUES ('COACH', NEW.user_id, 'trialing', private.new_subscription_trial_end())
    ON CONFLICT (coach_user_id) DO NOTHING;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_club_subscription_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.approved_at IS NOT NULL
       AND (TG_OP = 'INSERT' OR OLD.approved_at IS NULL) THEN
        INSERT INTO public.subscriptions (subscriber_type, club_id, status, trial_end)
        VALUES ('CLUB', NEW.id, 'trialing', private.new_subscription_trial_end())
        ON CONFLICT (club_id) DO NOTHING;
    END IF;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.create_coach_subscription_trial() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_club_subscription_trial() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER create_coach_subscription_trial
    AFTER INSERT ON public.coach_profiles
    FOR EACH ROW EXECUTE FUNCTION public.create_coach_subscription_trial();

CREATE TRIGGER create_club_subscription_trial
    AFTER INSERT OR UPDATE OF approved_at ON public.clubs
    FOR EACH ROW EXECUTE FUNCTION public.create_club_subscription_trial();

INSERT INTO public.subscriptions (subscriber_type, coach_user_id, status, trial_end)
SELECT 'COACH', cp.user_id, 'trialing', NULL
FROM public.coach_profiles cp
ON CONFLICT (coach_user_id) DO NOTHING;

INSERT INTO public.subscriptions (subscriber_type, club_id, status, trial_end)
SELECT 'CLUB', c.id, 'trialing', NULL
FROM public.clubs c
WHERE c.approved_at IS NOT NULL
ON CONFLICT (club_id) DO NOTHING;
