CREATE FUNCTION private.can_receive_coach_live_location_events(p_topic TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_session UUID;
BEGIN
    IF v_actor IS NULL OR p_topic IS NULL
        OR p_topic !~ '^coach-live-location:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN false;
    END IF;
    v_session := substring(p_topic FROM 21)::UUID;
    RETURN EXISTS (
        SELECT FROM public.coach_live_location_sessions s
        JOIN public.course_occurrences o ON o.id = s.occurrence_id
        JOIN public.courses c ON c.id = o.course_id
        JOIN public.profiles coach ON coach.id = s.coach_id AND coach.enabled AND coach.role = 'COACH'
        JOIN public.profiles actor ON actor.id = v_actor AND actor.enabled
        WHERE s.id = v_session AND c.active AND c.coach_id = s.coach_id
            AND o.starts_at <= clock_timestamp()
            AND clock_timestamp() < LEAST(s.expires_at, o.ends_at + INTERVAL '15 minutes')
            AND (
                (actor.role = 'COACH' AND c.coach_id = v_actor)
                OR (actor.role = 'CLUB' AND EXISTS (
                    SELECT FROM public.clubs cl WHERE cl.id = c.club_id AND cl.owner_user_id = v_actor
                ))
                OR (actor.role = 'PARENT' AND (
                    EXISTS (
                        SELECT FROM public.parent_live_location_consents pc WHERE pc.session_id = s.id AND pc.parent_id = v_actor
                    )
                    OR EXISTS (
                        SELECT FROM public.children ch
                        JOIN public.attendance a ON a.child_id = ch.id AND a.occurrence_id = o.id AND a.status = 'PRESENT'
                        JOIN public.attendance_accounting aa ON aa.child_id = ch.id AND aa.occurrence_id = o.id AND aa.qr_processed
                        WHERE ch.parent_id = v_actor AND EXISTS (
                            SELECT FROM public.enrollments e WHERE e.child_id = ch.id AND e.kind = 'COURSE'
                                AND e.entity_id = c.id AND e.status = 'ACTIVE'
                        )
                    )
                ))
            )
    );
END;
$$;

REVOKE ALL ON FUNCTION private.can_receive_coach_live_location_events(TEXT) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_receive_coach_live_location_events(TEXT) TO authenticated, service_role;

CREATE POLICY coach_live_location_receive ON realtime.messages
    FOR SELECT TO authenticated
    USING (extension = 'broadcast' AND topic = (SELECT realtime.topic())
        AND private.can_receive_coach_live_location_events((SELECT realtime.topic())));

CREATE POLICY coach_live_location_receive_guard ON realtime.messages
    AS RESTRICTIVE FOR SELECT TO authenticated
    USING (CASE WHEN topic LIKE 'coach-live-location:%' OR (SELECT realtime.topic()) LIKE 'coach-live-location:%'
        THEN extension = 'broadcast' AND topic = (SELECT realtime.topic())
            AND private.can_receive_coach_live_location_events((SELECT realtime.topic()))
        ELSE true END);

CREATE POLICY coach_live_location_anonymous_guard ON realtime.messages
    AS RESTRICTIVE FOR SELECT TO anon
    USING (topic NOT LIKE 'coach-live-location:%'
        AND coalesce((SELECT realtime.topic()) NOT LIKE 'coach-live-location:%', true));

CREATE POLICY coach_live_location_publish_guard ON realtime.messages
    AS RESTRICTIVE FOR INSERT TO anon, authenticated
    WITH CHECK (topic NOT LIKE 'coach-live-location:%'
        AND coalesce((SELECT realtime.topic()) NOT LIKE 'coach-live-location:%', true));

CREATE FUNCTION private.emit_coach_live_location_invalidation(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_session_id IS NOT NULL THEN
        PERFORM realtime.send('{}'::JSONB, 'invalidate', 'coach-live-location:' || p_session_id::TEXT, true);
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Live location notification unavailable; clients must revalidate.';
END;
$$;

CREATE FUNCTION private.notify_coach_live_location_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM private.emit_coach_live_location_invalidation(CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END);
    RETURN NULL;
END;
$$;

CREATE FUNCTION private.notify_coach_live_location_consent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM private.emit_coach_live_location_invalidation(CASE WHEN TG_OP = 'DELETE' THEN OLD.session_id ELSE NEW.session_id END);
    RETURN NULL;
END;
$$;

CREATE FUNCTION private.notify_coach_live_location_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_occurrences UUID[] := '{}';
    v_session UUID;
BEGIN
    IF TG_OP <> 'INSERT' THEN v_occurrences := array_append(v_occurrences, OLD.occurrence_id); END IF;
    IF TG_OP <> 'DELETE' THEN v_occurrences := array_append(v_occurrences, NEW.occurrence_id); END IF;
    FOR v_session IN SELECT id FROM public.coach_live_location_sessions WHERE occurrence_id = ANY(v_occurrences) LOOP
        PERFORM private.emit_coach_live_location_invalidation(v_session);
    END LOOP;
    RETURN NULL;
END;
$$;

CREATE FUNCTION private.notify_coach_live_location_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_courses UUID[] := '{}';
    v_session UUID;
BEGIN
    IF TG_OP <> 'INSERT' AND OLD.kind = 'COURSE' THEN v_courses := array_append(v_courses, OLD.entity_id); END IF;
    IF TG_OP <> 'DELETE' AND NEW.kind = 'COURSE' THEN v_courses := array_append(v_courses, NEW.entity_id); END IF;
    FOR v_session IN SELECT s.id FROM public.coach_live_location_sessions s
        JOIN public.course_occurrences o ON o.id = s.occurrence_id WHERE o.course_id = ANY(v_courses) LOOP
        PERFORM private.emit_coach_live_location_invalidation(v_session);
    END LOOP;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.emit_coach_live_location_invalidation(UUID),
    private.notify_coach_live_location_session(), private.notify_coach_live_location_consent(),
    private.notify_coach_live_location_attendance(), private.notify_coach_live_location_enrollment()
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.emit_coach_live_location_invalidation(UUID) TO service_role;

CREATE TRIGGER coach_live_location_session_invalidate
    AFTER INSERT OR UPDATE OR DELETE ON public.coach_live_location_sessions
    FOR EACH ROW EXECUTE FUNCTION private.notify_coach_live_location_session();
CREATE TRIGGER coach_live_location_consent_invalidate
    AFTER INSERT OR UPDATE OR DELETE ON public.parent_live_location_consents
    FOR EACH ROW EXECUTE FUNCTION private.notify_coach_live_location_consent();
CREATE TRIGGER coach_live_location_attendance_invalidate
    AFTER INSERT OR UPDATE OR DELETE ON public.attendance
    FOR EACH ROW EXECUTE FUNCTION private.notify_coach_live_location_attendance();
CREATE TRIGGER coach_live_location_qr_invalidate
    AFTER INSERT OR UPDATE OR DELETE ON public.attendance_accounting
    FOR EACH ROW EXECUTE FUNCTION private.notify_coach_live_location_attendance();
CREATE TRIGGER coach_live_location_enrollment_invalidate
    AFTER INSERT OR UPDATE OR DELETE ON public.enrollments
    FOR EACH ROW EXECUTE FUNCTION private.notify_coach_live_location_enrollment();
