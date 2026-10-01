CREATE SCHEMA IF NOT EXISTS private;

CREATE FUNCTION private.coach_identity_is_verified(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = p_user_id AND nullif(btrim(email), '') IS NOT NULL
            AND email_confirmed_at IS NOT NULL
            AND (banned_until IS NULL OR banned_until <= clock_timestamp())
            AND deleted_at IS NULL
    );
$$;

REVOKE ALL ON FUNCTION private.coach_identity_is_verified(UUID) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.coach_identity_is_verified(UUID) TO service_role;

CREATE FUNCTION public.redeem_coach_invitation(
    p_user_id UUID,
    p_invitation_code TEXT,
    p_name TEXT,
    p_phone TEXT DEFAULT NULL,
    p_bio TEXT DEFAULT NULL,
    p_sport_ids UUID[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_profile public.profiles;
    v_invitation public.coach_invitation_codes;
    v_coach_profile_id UUID;
    v_sport_ids UUID[] := coalesce(p_sport_ids, '{}');
    v_caller_id UUID := auth.uid();
BEGIN
    IF v_caller_id IS NOT NULL AND v_caller_id IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'IDENTITY_MISMATCH' USING ERRCODE = '42501';
    END IF;
    IF p_user_id IS NULL OR p_name IS NULL OR length(btrim(p_name)) < 2
        OR length(btrim(p_name)) > 200 OR p_invitation_code IS NULL
        OR length(btrim(p_invitation_code)) NOT BETWEEN 1 AND 200
        OR length(p_phone) > 50 OR length(p_bio) > 4000
        OR cardinality(v_sport_ids) > 50 OR array_position(v_sport_ids, NULL) IS NOT NULL THEN
        RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING ERRCODE = '42501';
    END IF;
    IF NOT v_profile.enabled THEN
        RAISE EXCEPTION 'PROFILE_DISABLED' USING ERRCODE = '42501';
    END IF;
    IF NOT private.coach_identity_is_verified(p_user_id) THEN
        RAISE EXCEPTION 'EMAIL_UNVERIFIED' USING ERRCODE = '42501';
    END IF;

    SELECT id INTO v_coach_profile_id FROM public.coach_profiles WHERE user_id = p_user_id;
    IF v_profile.role = 'COACH' AND v_coach_profile_id IS NOT NULL THEN
        RETURN jsonb_build_object('coachProfileId', v_coach_profile_id, 'alreadyCoach', true);
    END IF;
    IF v_profile.role <> 'PARENT' THEN
        RAISE EXCEPTION 'ROLE_NOT_ELIGIBLE' USING ERRCODE = '42501';
    END IF;
    IF v_coach_profile_id IS NOT NULL THEN
        RAISE EXCEPTION 'PROFILE_CONFLICT' USING ERRCODE = '23514';
    END IF;

    SELECT * INTO v_invitation FROM public.coach_invitation_codes
        WHERE code = btrim(p_invitation_code) FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_INVITATION' USING ERRCODE = '22023';
    END IF;
    IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at <= clock_timestamp() THEN
        RAISE EXCEPTION 'INVITATION_EXPIRED' USING ERRCODE = '23514';
    END IF;
    IF v_invitation.max_uses <= 0 OR v_invitation.current_uses < 0
        OR v_invitation.current_uses >= v_invitation.max_uses THEN
        RAISE EXCEPTION 'INVITATION_EXHAUSTED' USING ERRCODE = '23514';
    END IF;

    UPDATE public.profiles SET role = 'COACH', name = btrim(p_name),
        phone = coalesce(nullif(btrim(p_phone), ''), phone)
        WHERE id = p_user_id;
    INSERT INTO public.coach_profiles(user_id, bio)
        VALUES (p_user_id, nullif(btrim(p_bio), '')) RETURNING id INTO v_coach_profile_id;
    INSERT INTO public.coach_sports(coach_profile_id, sport_id)
        SELECT v_coach_profile_id, sport_id FROM unnest(v_sport_ids) AS selected(sport_id)
        GROUP BY sport_id;
    UPDATE public.coach_invitation_codes SET current_uses = current_uses + 1,
        used_by_user_id = p_user_id, used_at = clock_timestamp()
        WHERE id = v_invitation.id;

    RETURN jsonb_build_object('coachProfileId', v_coach_profile_id, 'alreadyCoach', false);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_coach_invitation(UUID,TEXT,TEXT,TEXT,TEXT,UUID[])
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_coach_invitation(UUID,TEXT,TEXT,TEXT,TEXT,UUID[])
    TO service_role;

NOTIFY pgrst, 'reload schema';
