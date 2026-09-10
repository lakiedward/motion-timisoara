CREATE FUNCTION private.location_session_available(p_session UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (
        SELECT FROM public.coach_live_location_sessions s
        JOIN public.profiles p ON p.id = s.coach_id AND p.enabled AND p.role = 'COACH'
        LEFT JOIN public.course_occurrences o ON o.id = s.occurrence_id
        LEFT JOIN public.courses c ON c.id = o.course_id
        LEFT JOIN public.camps camp ON camp.id = s.camp_id
        WHERE s.id = p_session AND clock_timestamp() < s.expires_at AND (
            (s.occurrence_id IS NOT NULL AND c.active AND c.coach_id = s.coach_id
                AND o.starts_at <= clock_timestamp() AND clock_timestamp() < o.ends_at + INTERVAL '15 minutes')
            OR (s.camp_id IS NOT NULL AND private.is_camp_location_coach(s.coach_id, s.camp_id)
                AND clock_timestamp() >= camp.period_start::TIMESTAMP AT TIME ZONE 'Europe/Bucharest'
                AND clock_timestamp() < (camp.period_end + 1)::TIMESTAMP AT TIME ZONE 'Europe/Bucharest')
        )
    );
$$;

CREATE FUNCTION private.location_session_audience(p_actor UUID, p_session UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (
        SELECT FROM public.coach_live_location_sessions s
        JOIN public.profiles p ON p.id = p_actor AND p.enabled
        LEFT JOIN public.course_occurrences o ON o.id = s.occurrence_id
        LEFT JOIN public.courses c ON c.id = o.course_id
        LEFT JOIN public.camps camp ON camp.id = s.camp_id
        WHERE s.id = p_session AND (
            (p.role = 'COACH' AND s.coach_id = p_actor)
            OR (p.role = 'CLUB' AND EXISTS (SELECT FROM public.clubs cl
                WHERE cl.id = coalesce(c.club_id, camp.club_id) AND cl.owner_user_id = p_actor))
            OR (p.role = 'PARENT' AND (
                (s.camp_id IS NOT NULL AND private.camp_location_parent_eligible(p_actor, s.camp_id))
                OR (s.occurrence_id IS NOT NULL AND EXISTS (
                    SELECT FROM public.children ch JOIN public.attendance a ON a.child_id = ch.id
                        AND a.occurrence_id = s.occurrence_id AND a.status = 'PRESENT'
                    JOIN public.attendance_accounting aa ON aa.child_id = ch.id
                        AND aa.occurrence_id = s.occurrence_id AND aa.qr_processed
                    WHERE ch.parent_id = p_actor AND EXISTS (SELECT FROM public.enrollments e
                        WHERE e.child_id = ch.id AND e.kind = 'COURSE' AND e.entity_id = c.id AND e.status = 'ACTIVE')
                ))
            ))
        )
    );
$$;

CREATE FUNCTION private.list_coach_live_locations(p_actor UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT CASE WHEN NOT EXISTS (SELECT FROM public.profiles WHERE id = p_actor
        AND enabled AND role IN ('PARENT','COACH','CLUB'))
        THEN jsonb_build_object('success',false,'code','FORBIDDEN')
        ELSE jsonb_build_object('success',true,'sessions', coalesce((
            SELECT jsonb_agg(jsonb_build_object('sessionId',s.id,'campId',s.camp_id,
                'occurrenceId',s.occurrence_id,'coachId',s.coach_id,'coachName',p.name,
                'title',coalesce(camp.title,c.name),'expiresAt',LEAST(s.expires_at,
                    CASE WHEN s.camp_id IS NOT NULL THEN (camp.period_end + 1)::TIMESTAMP AT TIME ZONE 'Europe/Bucharest'
                    ELSE o.ends_at + INTERVAL '15 minutes' END)) ORDER BY s.started_at DESC, s.id)
            FROM public.coach_live_location_sessions s JOIN public.profiles p ON p.id = s.coach_id
            LEFT JOIN public.camps camp ON camp.id = s.camp_id
            LEFT JOIN public.course_occurrences o ON o.id = s.occurrence_id
            LEFT JOIN public.courses c ON c.id = o.course_id
            WHERE private.location_session_available(s.id) AND private.location_session_audience(p_actor,s.id)
        ), '[]'::JSONB)) END;
$$;

CREATE OR REPLACE FUNCTION public.coach_live_location_transaction(p_actor_id UUID, p_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    IF p_actor_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
        RETURN jsonb_build_object('success',false,'code','INVALID_REQUEST');
    END IF;
    IF p_payload->>'action' = 'list' THEN
        IF p_payload <> '{"action":"list"}'::JSONB THEN
            RETURN jsonb_build_object('success',false,'code','INVALID_REQUEST');
        END IF;
        RETURN private.list_coach_live_locations(p_actor_id);
    END IF;
    IF p_payload->>'action' IN ('participants','arrive','depart') THEN
        RETURN private.camp_participation_transaction(p_actor_id,p_payload);
    END IF;
    RETURN private.coach_live_location_transaction(p_actor_id,p_payload);
END;
$$;

CREATE OR REPLACE FUNCTION private.purge_expired_coach_live_locations()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count INTEGER;
BEGIN
    DELETE FROM public.coach_live_location_sessions s WHERE NOT private.location_session_available(s.id);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    DELETE FROM public.coach_live_location_starts s
        WHERE clock_timestamp() >= GREATEST(s.expires_at, CASE WHEN s.camp_id IS NOT NULL
            THEN (SELECT (c.period_end + 1)::TIMESTAMP AT TIME ZONE 'Europe/Bucharest' FROM public.camps c WHERE c.id = s.camp_id)
            ELSE (SELECT o.ends_at + INTERVAL '15 minutes' FROM public.course_occurrences o WHERE o.id = s.occurrence_id) END);
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION private.can_receive_coach_live_location_events(p_topic TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid(); v_session UUID;
BEGIN
    IF v_actor IS NULL OR p_topic IS NULL
        OR p_topic !~ '^coach-live-location:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
    v_session := substring(p_topic FROM 21)::UUID;
    RETURN private.location_session_available(v_session) AND (
        private.location_session_audience(v_actor,v_session) OR EXISTS (
            SELECT FROM public.parent_live_location_consents pc
            JOIN public.profiles p ON p.id = pc.parent_id AND p.enabled AND p.role = 'PARENT'
            WHERE pc.session_id = v_session AND pc.parent_id = v_actor
        )
    );
END;
$$;

CREATE FUNCTION private.revoke_ineligible_camp_location_consents(p_camp UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM s.id FROM public.coach_live_location_sessions s WHERE s.camp_id = p_camp
        ORDER BY s.id FOR UPDATE;
    UPDATE public.parent_live_location_consents pc SET granted = false,
        version = LEAST(pc.version::BIGINT + 1, 2147483647)::INTEGER
        FROM public.coach_live_location_sessions s
        WHERE s.id = pc.session_id AND s.camp_id = p_camp AND pc.granted
            AND NOT private.camp_location_parent_eligible(pc.parent_id, p_camp);
END;
$$;

CREATE FUNCTION private.notify_camp_location_participation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_session UUID; v_camp UUID;
BEGIN
    v_camp := CASE WHEN TG_OP = 'DELETE' THEN OLD.camp_id ELSE NEW.camp_id END;
    PERFORM private.revoke_ineligible_camp_location_consents(v_camp);
    FOR v_session IN SELECT s.id FROM public.coach_live_location_sessions s
        WHERE s.camp_id = v_camp LOOP
        PERFORM private.emit_coach_live_location_invalidation(v_session);
    END LOOP;
    RETURN NULL;
END;
$$;
CREATE TRIGGER camp_location_participation_invalidate AFTER INSERT OR UPDATE OR DELETE ON public.camp_participation
    FOR EACH ROW EXECUTE FUNCTION private.notify_camp_location_participation();

CREATE OR REPLACE FUNCTION private.notify_coach_live_location_enrollment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_courses UUID[] := '{}'; v_camps UUID[] := '{}'; v_session UUID; v_camp UUID;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        IF OLD.kind = 'COURSE' THEN v_courses := array_append(v_courses,OLD.entity_id); END IF;
        IF OLD.kind = 'CAMP' THEN v_camps := array_append(v_camps,OLD.entity_id); END IF;
    END IF;
    IF TG_OP <> 'DELETE' THEN
        IF NEW.kind = 'COURSE' THEN v_courses := array_append(v_courses,NEW.entity_id); END IF;
        IF NEW.kind = 'CAMP' THEN v_camps := array_append(v_camps,NEW.entity_id); END IF;
    END IF;
    FOR v_camp IN SELECT DISTINCT unnest(v_camps) ORDER BY 1 LOOP
        PERFORM private.revoke_ineligible_camp_location_consents(v_camp);
    END LOOP;
    FOR v_session IN SELECT s.id FROM public.coach_live_location_sessions s
        LEFT JOIN public.course_occurrences o ON o.id = s.occurrence_id
        WHERE o.course_id = ANY(v_courses) OR s.camp_id = ANY(v_camps) LOOP
        PERFORM private.emit_coach_live_location_invalidation(v_session);
    END LOOP;
    RETURN NULL;
END;
$$;

CREATE FUNCTION private.notify_camp_location_child_parent()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_camp UUID;
BEGIN
    IF OLD.parent_id IS DISTINCT FROM NEW.parent_id THEN
        FOR v_camp IN SELECT DISTINCT e.entity_id FROM public.enrollments e
            WHERE e.child_id = NEW.id AND e.kind = 'CAMP' ORDER BY 1 LOOP
            PERFORM private.revoke_ineligible_camp_location_consents(v_camp);
        END LOOP;
    END IF;
    RETURN NULL;
END;
$$;
CREATE TRIGGER camp_location_child_parent_change AFTER UPDATE OF parent_id ON public.children
    FOR EACH ROW EXECUTE FUNCTION private.notify_camp_location_child_parent();

REVOKE ALL ON FUNCTION private.location_session_available(UUID), private.location_session_audience(UUID,UUID),
    private.list_coach_live_locations(UUID), private.notify_camp_location_participation(),
    private.revoke_ineligible_camp_location_consents(UUID), private.notify_camp_location_child_parent()
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.location_session_available(UUID), private.location_session_audience(UUID,UUID),
    private.list_coach_live_locations(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.coach_live_location_transaction(UUID,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coach_live_location_transaction(UUID,JSONB) TO service_role;
