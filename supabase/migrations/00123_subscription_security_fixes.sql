-- Subscription security fixes from the read-only review (To-Do #271):
-- bugs #1338, #1339, #1341 and the first step of #1342.
--
-- #1338: signed-in users could INSERT and UPDATE public.club_coaches directly
-- (policies from 00011) while the coach limit trigger only ran on INSERT. A
-- club owner could add coaches to a second, unapproved club without a limit
-- and then move them with UPDATE club_id. The app never writes club_coaches
-- from the browser: every addition goes through an edge function or a
-- SECURITY DEFINER RPC. Client INSERT and UPDATE are revoked and their
-- policies dropped; DELETE stays for the club owner and ADMIN. The limit
-- trigger also runs when a row moves to another club or another coach, so a
-- privileged path cannot bypass it either.
--
-- #1339: the Checkout function compared the coach count with the chosen plan
-- only when it created the Stripe session (valid 45 minutes). A club in its
-- free period without a plan has no limit, so it could add coaches during
-- that window and still pay for the smaller plan. Checkout now stores the
-- chosen plan as a hold with the session expiry; while the hold is active
-- the plan's limit applies like the current and scheduled plans.
-- hold_club_checkout_plan() counts and sets the hold under the same club row
-- lock as the limit trigger, so a parallel redemption cannot slip between.
--
-- #1341: create_coach_subscription_trial() created a COACH subscription row
-- for any coach_profiles insert, including PARENT or ADMIN accounts. The row
-- is now created only for COACH accounts, and also when an account with a
-- coach profile is promoted to COACH later. Inserting one's own coach profile
-- requires the COACH role. The single existing row for a non-COACH account
-- without a Stripe subscription is removed.
--
-- #1342 (step 1): subscriber_has_access, coach_has_access and
-- offer_has_access were executable by anon and authenticated, which let
-- anyone ask whether a club or coach has paid. RLS keeps using them through
-- the SECURITY DEFINER wrappers offer_listed/club_listed/coach_listed, which
-- run as their owner. EXECUTE is revoked from anon on all three and from
-- authenticated on coach_has_access and offer_has_access. The coach
-- subscription page gets my_covering_club_ids(), which answers only for the
-- caller's own clubs. subscriber_has_access stays executable by authenticated
-- until the frontend using my_covering_club_ids() is published; 00125 revokes
-- it then.

DROP POLICY IF EXISTS "club_coaches_insert" ON public.club_coaches;
DROP POLICY IF EXISTS "club_coaches_update" ON public.club_coaches;
REVOKE INSERT, UPDATE ON public.club_coaches FROM anon, authenticated;
REVOKE INSERT (club_id, coach_profile_id), UPDATE (club_id, coach_profile_id)
    ON public.club_coaches FROM anon, authenticated;

ALTER TABLE public.subscriptions
    ADD COLUMN checkout_plan_code TEXT,
    ADD COLUMN checkout_expires_at TIMESTAMPTZ,
    ADD CONSTRAINT subscriptions_checkout_plan_fk FOREIGN KEY (checkout_plan_code, subscriber_type)
        REFERENCES public.subscription_plans (code, subscriber_type) ON UPDATE RESTRICT ON DELETE RESTRICT,
    ADD CONSTRAINT subscriptions_checkout_hold_ck
        CHECK ((checkout_plan_code IS NULL) = (checkout_expires_at IS NULL));

CREATE OR REPLACE FUNCTION private.club_coach_limit(p_club_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT LEAST(cur.coach_limit, sch.coach_limit, hold.coach_limit)
    FROM public.subscriptions s
    LEFT JOIN public.subscription_plans cur ON cur.code = s.plan_code
    LEFT JOIN public.subscription_plans sch ON sch.code = s.scheduled_plan_code
    LEFT JOIN public.subscription_plans hold
        ON hold.code = s.checkout_plan_code AND s.checkout_expires_at > now()
    WHERE s.club_id = p_club_id
$$;
REVOKE ALL ON FUNCTION private.club_coach_limit(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hold_club_checkout_plan(
    p_club_id UUID,
    p_plan_code TEXT,
    p_expires_at TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_limit INTEGER;
    v_count INTEGER;
BEGIN
    SELECT p.coach_limit INTO v_limit
    FROM public.subscription_plans p
    WHERE p.code = p_plan_code AND p.subscriber_type = 'CLUB';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PLAN_NOT_FOUND' USING ERRCODE = '22023';
    END IF;
    PERFORM 1 FROM public.clubs WHERE id = p_club_id FOR UPDATE;
    SELECT count(*)::INTEGER INTO v_count FROM public.club_coaches WHERE club_id = p_club_id;
    IF v_limit IS NULL OR v_count <= v_limit THEN
        UPDATE public.subscriptions
        SET checkout_plan_code = p_plan_code,
            checkout_expires_at = p_expires_at
        WHERE club_id = p_club_id;
    END IF;
    RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.hold_club_checkout_plan(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hold_club_checkout_plan(UUID, TEXT, TIMESTAMPTZ) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_club_coach_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_limit INTEGER;
    v_count INTEGER;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.club_id = OLD.club_id THEN
        RETURN NEW;
    END IF;
    PERFORM 1 FROM public.clubs WHERE id = NEW.club_id FOR UPDATE;
    v_limit := private.club_coach_limit(NEW.club_id);
    IF v_limit IS NULL THEN
        RETURN NEW;
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.club_coaches
        WHERE club_id = NEW.club_id AND coach_profile_id = NEW.coach_profile_id
    ) THEN
        RETURN NEW;
    END IF;
    SELECT count(*) INTO v_count FROM public.club_coaches WHERE club_id = NEW.club_id;
    IF v_count >= v_limit THEN
        RAISE EXCEPTION 'COACH_LIMIT_REACHED'
            USING ERRCODE = '23514',
                  DETAIL = format('Clubul are %s antrenori din %s permiși de pachet.', v_count, v_limit);
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_club_coach_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_club_coach_limit ON public.club_coaches;
CREATE TRIGGER enforce_club_coach_limit
    BEFORE INSERT OR UPDATE OF club_id, coach_profile_id ON public.club_coaches
    FOR EACH ROW EXECUTE FUNCTION public.enforce_club_coach_limit();

CREATE OR REPLACE FUNCTION public.create_coach_subscription_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.user_id AND p.role = 'COACH') THEN
        INSERT INTO public.subscriptions (subscriber_type, coach_user_id, status, trial_end)
        VALUES ('COACH', NEW.user_id, 'trialing', private.new_subscription_trial_end())
        ON CONFLICT (coach_user_id) DO NOTHING;
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.create_coach_subscription_trial() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_promoted_coach_subscription_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.coach_profiles cp WHERE cp.user_id = NEW.id) THEN
        INSERT INTO public.subscriptions (subscriber_type, coach_user_id, status, trial_end)
        VALUES ('COACH', NEW.id, 'trialing', private.new_subscription_trial_end())
        ON CONFLICT (coach_user_id) DO NOTHING;
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.create_promoted_coach_subscription_trial() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS create_promoted_coach_subscription_trial ON public.profiles;
CREATE TRIGGER create_promoted_coach_subscription_trial
    AFTER UPDATE OF role ON public.profiles
    FOR EACH ROW
    WHEN (NEW.role = 'COACH' AND OLD.role IS DISTINCT FROM 'COACH')
    EXECUTE FUNCTION public.create_promoted_coach_subscription_trial();

DROP POLICY IF EXISTS "coach_profiles_insert" ON public.coach_profiles;
CREATE POLICY "coach_profiles_insert" ON public.coach_profiles
    FOR INSERT TO authenticated
    WITH CHECK (
        (user_id = (SELECT auth.uid()) AND (SELECT public.get_my_role()) = 'COACH')
        OR (SELECT public.get_my_role()) = 'ADMIN'
    );

DELETE FROM public.subscriptions s
USING public.profiles p
WHERE s.subscriber_type = 'COACH'
  AND p.id = s.coach_user_id
  AND p.role <> 'COACH'
  AND s.stripe_subscription_id IS NULL
  AND s.stripe_customer_id IS NULL;

REVOKE EXECUTE ON FUNCTION public.subscriber_has_access(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.coach_has_access(UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.offer_has_access(UUID, UUID) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_covering_club_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT cc.club_id
    FROM public.club_coaches cc
    JOIN public.coach_profiles cp ON cp.id = cc.coach_profile_id
    WHERE cp.user_id = (SELECT auth.uid())
      AND public.subscriber_has_access(cc.club_id, NULL)
$$;
REVOKE ALL ON FUNCTION public.my_covering_club_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_covering_club_ids() TO authenticated, service_role;
