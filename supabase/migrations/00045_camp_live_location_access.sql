ALTER TABLE public.coach_live_location_sessions
    ALTER COLUMN occurrence_id DROP NOT NULL,
    ADD COLUMN camp_id UUID REFERENCES public.camps(id) ON DELETE CASCADE,
    ADD CONSTRAINT coach_live_location_target CHECK (num_nonnulls(occurrence_id, camp_id) = 1),
    ADD CONSTRAINT coach_live_location_camp_coach UNIQUE (camp_id, coach_id);
ALTER TABLE public.coach_live_location_starts
    ALTER COLUMN occurrence_id DROP NOT NULL,
    ADD COLUMN camp_id UUID REFERENCES public.camps(id) ON DELETE CASCADE,
    ADD CONSTRAINT coach_live_location_start_target CHECK (num_nonnulls(occurrence_id, camp_id) = 1);

CREATE TABLE public.camp_participation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL UNIQUE REFERENCES public.enrollments(id) ON DELETE CASCADE,
    camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
    arrived_at TIMESTAMPTZ NOT NULL,
    departed_at TIMESTAMPTZ,
    arrived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    departed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (departed_at IS NULL OR departed_at >= arrived_at)
);
CREATE INDEX camp_participation_camp_idx ON public.camp_participation(camp_id);
ALTER TABLE public.camp_participation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.camp_participation FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.camp_participation TO service_role;

CREATE FUNCTION private.is_camp_location_coach(p_actor UUID, p_camp UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (
        SELECT FROM public.profiles p JOIN public.camps c ON c.id = p_camp
        WHERE p.id = p_actor AND p.enabled AND p.role = 'COACH'
          AND (c.coach_id = p_actor OR EXISTS (
              SELECT FROM public.camp_coaches cc
              JOIN public.coach_profiles cp ON cp.id = cc.coach_profile_id
              WHERE cc.camp_id = c.id AND cp.user_id = p_actor AND cc.status = 'accepted'
          ))
    );
$$;

CREATE FUNCTION private.is_camp_location_staff(p_actor UUID, p_camp UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT private.is_camp_location_coach(p_actor, p_camp) OR EXISTS (
        SELECT FROM public.camps c JOIN public.clubs cl ON cl.id = c.club_id
        JOIN public.profiles p ON p.id = cl.owner_user_id
        WHERE c.id = p_camp AND p.id = p_actor AND p.enabled AND p.role = 'CLUB'
    );
$$;

CREATE FUNCTION private.camp_location_parent_eligible(p_actor UUID, p_camp UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (
        SELECT FROM public.enrollments e
        JOIN public.children ch ON ch.id = e.child_id
        JOIN public.camp_participation a ON a.enrollment_id = e.id AND a.camp_id = e.entity_id
        WHERE ch.parent_id = p_actor AND e.kind = 'CAMP' AND e.entity_id = p_camp
            AND e.status = 'ACTIVE' AND a.departed_at IS NULL
    );
$$;

CREATE FUNCTION private.camp_participation_transaction(p_actor UUID, p_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_action TEXT := p_payload->>'action';
    v_camp UUID;
    v_enrollment UUID;
    v_starts TIMESTAMPTZ;
    v_ends TIMESTAMPTZ;
    v_items JSONB;
    v_now TIMESTAMPTZ;
BEGIN
    IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR p_actor IS NULL
        OR v_action IS NULL OR v_action NOT IN ('participants', 'arrive', 'depart')
        OR jsonb_typeof(p_payload->'campId') IS DISTINCT FROM 'string'
        OR EXISTS (SELECT FROM jsonb_object_keys(p_payload) k WHERE k <> ALL(
            CASE WHEN v_action = 'participants' THEN ARRAY['action','campId']
            ELSE ARRAY['action','campId','enrollmentId'] END)) THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_REQUEST');
    END IF;
    v_camp := (p_payload->>'campId')::UUID;
    SELECT c.period_start::TIMESTAMP AT TIME ZONE 'Europe/Bucharest',
        (c.period_end + 1)::TIMESTAMP AT TIME ZONE 'Europe/Bucharest'
        INTO v_starts, v_ends FROM public.camps c WHERE c.id = v_camp FOR SHARE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN');
    END IF;
    PERFORM FROM public.profiles WHERE id = p_actor FOR SHARE;
    PERFORM FROM public.coach_profiles WHERE user_id = p_actor FOR SHARE;
    PERFORM FROM public.camp_coaches cc JOIN public.coach_profiles cp ON cp.id = cc.coach_profile_id
        WHERE cc.camp_id = v_camp AND cp.user_id = p_actor FOR SHARE OF cc;
    IF NOT private.is_camp_location_staff(p_actor, v_camp) THEN
        RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN');
    END IF;
    IF v_action = 'participants' THEN
        SELECT coalesce(jsonb_agg(jsonb_build_object('enrollmentId', e.id, 'childName', ch.name,
            'arrivedAt', a.arrived_at, 'departedAt', a.departed_at) ORDER BY ch.name, e.id), '[]'::JSONB)
            INTO v_items FROM public.enrollments e JOIN public.children ch ON ch.id = e.child_id
            LEFT JOIN public.camp_participation a ON a.enrollment_id = e.id AND a.camp_id = v_camp
            WHERE e.kind = 'CAMP' AND e.entity_id = v_camp AND e.status = 'ACTIVE';
        RETURN jsonb_build_object('success', true, 'participants', v_items, 'startsAt', v_starts,
            'endsAt', v_ends, 'canShare', private.is_camp_location_coach(p_actor, v_camp));
    END IF;
    IF jsonb_typeof(p_payload->'enrollmentId') IS DISTINCT FROM 'string' THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_REQUEST');
    END IF;
    v_enrollment := (p_payload->>'enrollmentId')::UUID;
    PERFORM FROM public.enrollments WHERE id = v_enrollment AND kind = 'CAMP'
        AND entity_id = v_camp AND status = 'ACTIVE' FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_ELIGIBLE');
    END IF;
    v_now := clock_timestamp();
    IF v_now < v_starts OR v_now >= v_ends THEN
        RETURN jsonb_build_object('success', false, 'code', 'SESSION_EXPIRED');
    END IF;
    IF v_action = 'arrive' THEN
        INSERT INTO public.camp_participation(enrollment_id,camp_id,arrived_at,arrived_by,created_at,updated_at)
            VALUES (v_enrollment,v_camp,v_now,p_actor,v_now,v_now) ON CONFLICT(enrollment_id) DO NOTHING;
    ELSE
        UPDATE public.camp_participation SET departed_at = v_now, departed_by = p_actor, updated_at = v_now
            WHERE enrollment_id = v_enrollment AND camp_id = v_camp AND departed_at IS NULL;
        IF NOT FOUND AND NOT EXISTS (SELECT FROM public.camp_participation
            WHERE enrollment_id = v_enrollment AND camp_id = v_camp AND departed_at IS NOT NULL) THEN
            RETURN jsonb_build_object('success', false, 'code', 'NOT_ELIGIBLE');
        END IF;
    END IF;
    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN invalid_text_representation THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_REQUEST');
END;
$$;

REVOKE ALL ON FUNCTION private.is_camp_location_coach(UUID,UUID),
    private.is_camp_location_staff(UUID,UUID), private.camp_location_parent_eligible(UUID,UUID),
    private.camp_participation_transaction(UUID,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_camp_location_coach(UUID,UUID),
    private.is_camp_location_staff(UUID,UUID), private.camp_location_parent_eligible(UUID,UUID),
    private.camp_participation_transaction(UUID,JSONB) TO service_role;
