-- Feature #615: coach limit per club plan (spec section "Club coach limits").
--
-- The limit counts club_coaches rows (managed coaches included; pending
-- invitation codes do not count). A club without a chosen plan (no row, or a
-- trial without plan_code) has no limit; CLUB_START allows 3, CLUB 10 and
-- CLUB_PRO is unlimited. When a downgrade is scheduled, the smaller of the
-- current and scheduled limits applies, so a club cannot add coaches that would
-- make the pending downgrade impossible. Existing coaches are never removed.
--
-- The rule is a BEFORE INSERT trigger on club_coaches, so the three entry paths
-- (invitation redemption, registration with a club code, managed coach) and
-- any future one share it. The trigger locks the club row first, which
-- serialises parallel additions: two redemptions at 2/3 cannot both pass.
-- The refusal is SQLSTATE 23514 with message COACH_LIMIT_REACHED, which the
-- edge functions and the client map to a Romanian message.
--
-- club_coach_capacity() gives the edge functions (managed coach precheck, the
-- club subscription page in #618) the count, the effective limit and how many
-- coaches a given plan would require removing.

CREATE OR REPLACE FUNCTION private.club_coach_limit(p_club_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT CASE
        WHEN cur.code IS NULL AND sch.code IS NULL THEN NULL
        WHEN cur.coach_limit IS NULL THEN sch.coach_limit
        WHEN sch.coach_limit IS NULL THEN cur.coach_limit
        ELSE LEAST(cur.coach_limit, sch.coach_limit)
    END
    FROM public.subscriptions s
    LEFT JOIN public.subscription_plans cur ON cur.code = s.plan_code
    LEFT JOIN public.subscription_plans sch ON sch.code = s.scheduled_plan_code
    WHERE s.club_id = p_club_id
$$;
REVOKE ALL ON FUNCTION private.club_coach_limit(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.club_coach_capacity(p_club_id UUID, p_plan_code TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    WITH counted AS (
        SELECT count(*)::INTEGER AS coaches FROM public.club_coaches WHERE club_id = p_club_id
    ),
    target AS (
        SELECT p.coach_limit FROM public.subscription_plans p
        WHERE p.code = p_plan_code AND p.subscriber_type = 'CLUB'
    )
    SELECT jsonb_build_object(
        'coachCount', c.coaches,
        'coachLimit', private.club_coach_limit(p_club_id),
        'hasRoom', private.club_coach_limit(p_club_id) IS NULL OR c.coaches < private.club_coach_limit(p_club_id),
        'planCoachLimit', (SELECT t.coach_limit FROM target t),
        'coachesToRemove', CASE
            WHEN p_plan_code IS NULL OR NOT EXISTS (SELECT 1 FROM target) THEN NULL
            ELSE GREATEST(c.coaches - COALESCE((SELECT t.coach_limit FROM target t), c.coaches), 0)
        END
    )
    FROM counted c
$$;
REVOKE ALL ON FUNCTION public.club_coach_capacity(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_coach_capacity(UUID, TEXT) TO service_role;

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

CREATE TRIGGER enforce_club_coach_limit
    BEFORE INSERT ON public.club_coaches
    FOR EACH ROW EXECUTE FUNCTION public.enforce_club_coach_limit();
