CREATE FUNCTION private.claim_club_invitation(p_coach_profile_id UUID, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_invitation public.club_invitation_codes;
    v_club_name TEXT;
BEGIN
    SELECT * INTO v_invitation FROM public.club_invitation_codes
        WHERE code = btrim(p_code) FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_INVITATION' USING ERRCODE = '22023';
    END IF;
    SELECT name INTO v_club_name FROM public.clubs WHERE id = v_invitation.club_id;
    IF EXISTS (
        SELECT 1 FROM public.club_coaches
        WHERE club_id = v_invitation.club_id AND coach_profile_id = p_coach_profile_id
    ) THEN
        RETURN jsonb_build_object('clubId', v_invitation.club_id, 'clubName', v_club_name,
            'alreadyMember', true);
    END IF;
    IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at <= clock_timestamp() THEN
        RAISE EXCEPTION 'INVITATION_EXPIRED' USING ERRCODE = '23514';
    END IF;
    IF v_invitation.max_uses <= 0 OR v_invitation.current_uses < 0
        OR v_invitation.current_uses >= v_invitation.max_uses THEN
        RAISE EXCEPTION 'INVITATION_EXHAUSTED' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.club_coaches(club_id, coach_profile_id)
        VALUES (v_invitation.club_id, p_coach_profile_id);
    UPDATE public.club_invitation_codes SET current_uses = current_uses + 1
        WHERE id = v_invitation.id;

    RETURN jsonb_build_object('clubId', v_invitation.club_id, 'clubName', v_club_name,
        'alreadyMember', false);
END;
$$;

REVOKE ALL ON FUNCTION private.claim_club_invitation(UUID,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.claim_club_invitation(UUID,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.redeem_coach_invitation(
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
    v_is_club_code BOOLEAN := false;
    v_club JSONB;
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

    SELECT * INTO v_invitation FROM public.coach_invitation_codes
        WHERE code = btrim(p_invitation_code) FOR UPDATE;
    IF NOT FOUND THEN
        v_is_club_code := EXISTS (
            SELECT 1 FROM public.club_invitation_codes WHERE code = btrim(p_invitation_code)
        );
    END IF;

    SELECT id INTO v_coach_profile_id FROM public.coach_profiles WHERE user_id = p_user_id;
    IF v_profile.role = 'COACH' AND v_coach_profile_id IS NOT NULL THEN
        IF v_is_club_code THEN
            v_club := private.claim_club_invitation(v_coach_profile_id, p_invitation_code);
            RETURN jsonb_build_object('coachProfileId', v_coach_profile_id, 'alreadyCoach', true,
                'clubId', v_club->'clubId');
        END IF;
        RETURN jsonb_build_object('coachProfileId', v_coach_profile_id, 'alreadyCoach', true);
    END IF;
    IF v_profile.role <> 'PARENT' THEN
        RAISE EXCEPTION 'ROLE_NOT_ELIGIBLE' USING ERRCODE = '42501';
    END IF;
    IF v_coach_profile_id IS NOT NULL THEN
        RAISE EXCEPTION 'PROFILE_CONFLICT' USING ERRCODE = '23514';
    END IF;

    IF v_invitation.id IS NULL AND NOT v_is_club_code THEN
        RAISE EXCEPTION 'INVALID_INVITATION' USING ERRCODE = '22023';
    END IF;
    IF v_invitation.id IS NOT NULL THEN
        IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at <= clock_timestamp() THEN
            RAISE EXCEPTION 'INVITATION_EXPIRED' USING ERRCODE = '23514';
        END IF;
        IF v_invitation.max_uses <= 0 OR v_invitation.current_uses < 0
            OR v_invitation.current_uses >= v_invitation.max_uses THEN
            RAISE EXCEPTION 'INVITATION_EXHAUSTED' USING ERRCODE = '23514';
        END IF;
    END IF;

    UPDATE public.profiles SET role = 'COACH', name = btrim(p_name),
        phone = coalesce(nullif(btrim(p_phone), ''), phone)
        WHERE id = p_user_id;
    INSERT INTO public.coach_profiles(user_id, bio)
        VALUES (p_user_id, nullif(btrim(p_bio), '')) RETURNING id INTO v_coach_profile_id;
    INSERT INTO public.coach_sports(coach_profile_id, sport_id)
        SELECT v_coach_profile_id, sport_id FROM unnest(v_sport_ids) AS selected(sport_id)
        GROUP BY sport_id;

    IF v_is_club_code THEN
        v_club := private.claim_club_invitation(v_coach_profile_id, p_invitation_code);
        RETURN jsonb_build_object('coachProfileId', v_coach_profile_id, 'alreadyCoach', false,
            'clubId', v_club->'clubId');
    END IF;

    UPDATE public.coach_invitation_codes SET current_uses = current_uses + 1,
        used_by_user_id = p_user_id, used_at = clock_timestamp()
        WHERE id = v_invitation.id;

    RETURN jsonb_build_object('coachProfileId', v_coach_profile_id, 'alreadyCoach', false);
END;
$$;

CREATE FUNCTION public.join_club_by_invitation(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_profile public.profiles;
    v_coach_profile_id UUID;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
    END IF;
    IF p_code IS NULL OR length(btrim(p_code)) NOT BETWEEN 1 AND 200 THEN
        RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_caller_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING ERRCODE = '42501';
    END IF;
    IF NOT v_profile.enabled THEN
        RAISE EXCEPTION 'PROFILE_DISABLED' USING ERRCODE = '42501';
    END IF;
    SELECT id INTO v_coach_profile_id FROM public.coach_profiles WHERE user_id = v_caller_id;
    IF v_profile.role <> 'COACH' OR v_coach_profile_id IS NULL THEN
        RAISE EXCEPTION 'ROLE_NOT_ELIGIBLE' USING ERRCODE = '42501';
    END IF;
    RETURN private.claim_club_invitation(v_coach_profile_id, p_code);
END;
$$;

REVOKE ALL ON FUNCTION public.join_club_by_invitation(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_club_by_invitation(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
