CREATE OR REPLACE FUNCTION private.coach_live_location_transaction(p_actor_id UUID, p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_action TEXT;
    v_occurrence UUID;
    v_camp UUID;
    v_target_keys TEXT[];
    v_deadline TIMESTAMPTZ;
    v_start_expiry TIMESTAMPTZ;
    v_max_camp_sharing CONSTANT INTERVAL := INTERVAL '8 hours';
    v_session_id UUID;
    v_request_id UUID;
    v_expected_version INTEGER;
    v_role TEXT;
    v_course UUID;
    v_coach UUID;
    v_club UUID;
    v_active BOOLEAN;
    v_starts TIMESTAMPTZ;
    v_ends TIMESTAMPTZ;
    v_now TIMESTAMPTZ;
    v_expiry TIMESTAMPTZ;
    v_session public.coach_live_location_sessions%ROWTYPE;
    v_start public.coach_live_location_starts%ROWTYPE;
    v_location public.coach_live_locations%ROWTYPE;
    v_consent public.parent_live_location_consents%ROWTYPE;
    v_latitude DOUBLE PRECISION;
    v_longitude DOUBLE PRECISION;
    v_accuracy DOUBLE PRECISION;
    v_captured TIMESTAMPTZ;
    v_eligible BOOLEAN;
    v_allowed_keys TEXT[];
BEGIN
    IF p_actor_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_REQUEST');
    END IF;
    v_action := p_payload->>'action';
    IF v_action IS NULL OR v_action NOT IN ('start', 'update', 'stop', 'consent', 'read', 'status') THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_REQUEST');
    END IF;
    v_allowed_keys := CASE v_action
        WHEN 'start' THEN ARRAY['action', 'occurrenceId', 'consent', 'requestId']
        WHEN 'status' THEN ARRAY['action', 'occurrenceId']
        WHEN 'update' THEN ARRAY['action', 'occurrenceId', 'sessionId', 'latitude', 'longitude', 'accuracy', 'capturedAt']
        WHEN 'consent' THEN ARRAY['action', 'occurrenceId', 'sessionId', 'consent', 'expectedVersion']
        ELSE ARRAY['action', 'occurrenceId', 'sessionId'] END;
    IF p_payload ? 'campId' THEN
        v_allowed_keys := array_remove(v_allowed_keys, 'occurrenceId') || ARRAY['campId', 'coachId'];
        v_target_keys := ARRAY['campId', 'coachId'];
    ELSE
        v_target_keys := ARRAY['occurrenceId'];
    END IF;
    IF EXISTS (SELECT FROM unnest(v_target_keys) k WHERE jsonb_typeof(p_payload->k) IS DISTINCT FROM 'string')
        OR EXISTS (SELECT FROM jsonb_object_keys(p_payload) AS k(key) WHERE NOT k.key = ANY(v_allowed_keys))
        OR (v_action = 'start' AND jsonb_typeof(p_payload->'requestId') IS DISTINCT FROM 'string')
        OR (v_action NOT IN ('start', 'status') AND jsonb_typeof(p_payload->'sessionId') IS DISTINCT FROM 'string')
        OR (v_action IN ('start', 'consent') AND jsonb_typeof(p_payload->'consent') IS DISTINCT FROM 'boolean') THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_REQUEST');
    END IF;
    v_occurrence := (p_payload->>'occurrenceId')::UUID;
    v_camp := (p_payload->>'campId')::UUID;
    IF v_camp IS NOT NULL THEN v_coach := (p_payload->>'coachId')::UUID; END IF;
    v_session_id := (p_payload->>'sessionId')::UUID;
    v_request_id := (p_payload->>'requestId')::UUID;
    IF v_action = 'consent' THEN
        IF jsonb_typeof(p_payload->'expectedVersion') IS DISTINCT FROM 'number' THEN
            RETURN jsonb_build_object('success', false, 'code', 'INVALID_REQUEST');
        END IF;
        IF (p_payload->>'expectedVersion')::NUMERIC NOT BETWEEN 0 AND 2147483646
            OR (p_payload->>'expectedVersion')::NUMERIC <> trunc((p_payload->>'expectedVersion')::NUMERIC) THEN
            RETURN jsonb_build_object('success', false, 'code', 'INVALID_REQUEST');
        END IF;
        v_expected_version := (p_payload->>'expectedVersion')::NUMERIC::INTEGER;
    END IF;
    SELECT role INTO v_role FROM public.profiles WHERE id = p_actor_id AND enabled FOR SHARE;
    IF v_role IS NULL OR v_role NOT IN ('COACH', 'CLUB', 'PARENT') THEN
        RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN');
    END IF;
    IF v_action = 'start' THEN
        PERFORM pg_advisory_xact_lock(hashtextextended('coach-live-start:' || v_request_id::TEXT, 0));
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('coach-live-location:' || coalesce(v_occurrence::TEXT, v_camp::TEXT || ':' || v_coach::TEXT), 0));
    IF v_camp IS NULL THEN
    SELECT o.course_id, c.coach_id, c.club_id, c.active, o.starts_at, o.ends_at
        INTO v_course, v_coach, v_club, v_active, v_starts, v_ends
        FROM public.course_occurrences o JOIN public.courses c ON c.id = o.course_id
        WHERE o.id = v_occurrence FOR SHARE OF o, c;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'OCCURRENCE_NOT_FOUND');
    END IF;
    v_deadline := v_ends + INTERVAL '15 minutes';
    ELSE
        SELECT c.club_id, c.period_start::TIMESTAMP AT TIME ZONE 'Europe/Bucharest',
            (c.period_end + 1)::TIMESTAMP AT TIME ZONE 'Europe/Bucharest'
            INTO v_club, v_starts, v_ends FROM public.camps c WHERE c.id = v_camp FOR SHARE;
        IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'code', 'CAMP_NOT_FOUND'); END IF;
        PERFORM FROM public.profiles WHERE id = v_coach FOR SHARE;
        PERFORM FROM public.coach_profiles WHERE user_id = v_coach FOR SHARE;
        PERFORM FROM public.camp_coaches cc JOIN public.coach_profiles cp ON cp.id = cc.coach_profile_id
            WHERE cc.camp_id = v_camp AND cp.user_id = v_coach FOR SHARE OF cc;
        v_active := private.is_camp_location_coach(v_coach, v_camp);
        v_deadline := v_ends;
        IF NOT v_active AND NOT (v_action = 'stop' AND v_role = 'COACH' AND v_coach = p_actor_id) THEN
            RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN');
        END IF;
    END IF;
    IF v_action IN ('start', 'update', 'stop') AND (v_role <> 'COACH' OR v_coach <> p_actor_id) THEN
        RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN');
    END IF;
    IF v_role = 'COACH' AND v_coach <> p_actor_id THEN
        RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN');
    END IF;
    IF v_role = 'CLUB' AND NOT EXISTS (
        SELECT FROM public.clubs WHERE id = v_club AND owner_user_id = p_actor_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN');
    END IF;
    IF v_action = 'consent' AND v_role <> 'PARENT' THEN
        RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN');
    END IF;
    SELECT * INTO v_session FROM public.coach_live_location_sessions
        WHERE (occurrence_id = v_occurrence OR (camp_id = v_camp AND coach_id = v_coach)) FOR UPDATE;
    v_now := clock_timestamp();
    v_expiry := LEAST(v_session.expires_at, v_deadline);
    IF v_session.id IS NOT NULL AND (v_now >= v_expiry OR v_session.coach_id <> v_coach
        OR NOT v_active OR v_now < v_starts OR NOT EXISTS (
            SELECT FROM public.profiles WHERE id = v_session.coach_id AND enabled AND role = 'COACH'
        )) THEN
        DELETE FROM public.coach_live_location_sessions WHERE id = v_session.id;
        IF v_action <> 'start' THEN
            RETURN jsonb_build_object('success', false, 'code', 'SESSION_EXPIRED');
        END IF;
        v_session := NULL;
    END IF;
    IF v_action = 'start' THEN
        IF p_payload->'consent' IS DISTINCT FROM 'true'::JSONB THEN
            RETURN jsonb_build_object('success', false, 'code', 'CONSENT_REQUIRED');
        END IF;
        IF NOT v_active OR NOT isfinite(v_starts) OR NOT isfinite(v_ends)
            OR v_now < v_starts OR v_now >= v_deadline
            OR v_ends <= v_starts THEN
            RETURN jsonb_build_object('success', false, 'code', 'SESSION_EXPIRED');
        END IF;
        SELECT * INTO v_start FROM public.coach_live_location_starts WHERE id = v_request_id FOR UPDATE;
        IF v_start.id IS NOT NULL THEN
            IF v_start.coach_id <> p_actor_id OR v_start.occurrence_id IS DISTINCT FROM v_occurrence OR v_start.camp_id IS DISTINCT FROM v_camp THEN
                RETURN jsonb_build_object('success', false, 'code', 'INVALID_REQUEST');
            END IF;
            IF v_session.id IS NULL OR v_start.session_id <> v_session.id THEN
                RETURN jsonb_build_object('success', false, 'code', 'SESSION_NOT_FOUND');
            END IF;
        END IF;
        v_now := clock_timestamp();
        IF v_now >= LEAST(v_session.expires_at, v_deadline) THEN
            DELETE FROM public.coach_live_location_sessions WHERE id = v_session.id;
            RETURN jsonb_build_object('success', false, 'code', 'SESSION_EXPIRED');
        END IF;
        v_start_expiry := CASE WHEN v_camp IS NULL THEN v_deadline ELSE LEAST(v_deadline, v_now + v_max_camp_sharing) END;
        IF v_session.id IS NULL THEN
            INSERT INTO public.coach_live_location_sessions
                (occurrence_id, camp_id, coach_id, consented_at, started_at, expires_at, created_at, updated_at)
                VALUES (v_occurrence, v_camp, p_actor_id, v_now, v_now, v_start_expiry, v_now, v_now)
                RETURNING * INTO v_session;
        END IF;
        INSERT INTO public.coach_live_location_starts (id, coach_id, occurrence_id, camp_id, session_id, expires_at, created_at)
            VALUES (v_request_id, p_actor_id, v_occurrence, v_camp, v_session.id, v_session.expires_at, v_now)
            ON CONFLICT (id) DO NOTHING;
        IF clock_timestamp() >= LEAST(v_session.expires_at, v_deadline) THEN
            DELETE FROM public.coach_live_location_sessions WHERE id = v_session.id;
            IF v_start.id IS NULL THEN
                DELETE FROM public.coach_live_location_starts WHERE id = v_request_id;
            END IF;
            RETURN jsonb_build_object('success', false, 'code', 'SESSION_EXPIRED');
        END IF;
        RETURN jsonb_build_object('success', true, 'sessionId', v_session.id,
            'expiresAt', LEAST(v_session.expires_at, v_deadline));
    END IF;
    IF v_session.id IS NULL OR (v_action <> 'status' AND v_session.id <> v_session_id) THEN
        RETURN jsonb_build_object('success', false, 'code', 'SESSION_NOT_FOUND');
    END IF;
    IF v_action = 'stop' THEN
        DELETE FROM public.coach_live_location_sessions WHERE id = v_session.id;
        RETURN jsonb_build_object('success', true, 'sessionId', v_session.id);
    END IF;
    IF v_action = 'update' THEN
        IF jsonb_typeof(p_payload->'latitude') IS DISTINCT FROM 'number'
            OR jsonb_typeof(p_payload->'longitude') IS DISTINCT FROM 'number'
            OR jsonb_typeof(p_payload->'accuracy') IS DISTINCT FROM 'number'
            OR jsonb_typeof(p_payload->'capturedAt') IS DISTINCT FROM 'string'
            OR (p_payload->>'capturedAt') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' THEN
            RETURN jsonb_build_object('success', false, 'code', 'INVALID_REQUEST');
        END IF;
        v_latitude := (p_payload->>'latitude')::DOUBLE PRECISION;
        v_longitude := (p_payload->>'longitude')::DOUBLE PRECISION;
        v_accuracy := (p_payload->>'accuracy')::DOUBLE PRECISION;
        v_captured := (p_payload->>'capturedAt')::TIMESTAMPTZ;
        IF v_latitude NOT BETWEEN -90 AND 90 OR v_longitude NOT BETWEEN -180 AND 180
            OR v_accuracy NOT BETWEEN 0 AND 10000 OR NOT isfinite(v_captured) THEN
            RETURN jsonb_build_object('success', false, 'code', 'INVALID_REQUEST');
        END IF;
        SELECT * INTO v_location FROM public.coach_live_locations WHERE session_id = v_session.id FOR UPDATE;
        IF v_captured < v_session.started_at OR v_captured < v_now - INTERVAL '2 minutes'
            OR v_captured > v_now + INTERVAL '30 seconds'
            OR (v_location.id IS NOT NULL AND v_captured <= v_location.captured_at) THEN
            RETURN jsonb_build_object('success', false, 'code', 'STALE_LOCATION');
        END IF;
        v_now := clock_timestamp();
        IF v_now >= v_expiry THEN
            DELETE FROM public.coach_live_location_sessions WHERE id = v_session.id;
            RETURN jsonb_build_object('success', false, 'code', 'SESSION_EXPIRED');
        END IF;
        INSERT INTO public.coach_live_locations
            (session_id, latitude, longitude, accuracy, captured_at, created_at, updated_at)
            VALUES (v_session.id, v_latitude, v_longitude, v_accuracy, v_captured, v_now, v_now)
            ON CONFLICT (session_id) DO UPDATE SET latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude, accuracy = EXCLUDED.accuracy,
                captured_at = EXCLUDED.captured_at, updated_at = EXCLUDED.updated_at;
        UPDATE public.coach_live_location_sessions SET updated_at = v_now WHERE id = v_session.id;
        RETURN jsonb_build_object('success', true, 'sessionId', v_session.id, 'expiresAt', v_expiry);
    END IF;
    IF v_role = 'PARENT' THEN
        SELECT * INTO v_consent FROM public.parent_live_location_consents
            WHERE session_id = v_session.id AND parent_id = p_actor_id FOR UPDATE;
        IF v_action = 'consent' AND v_expected_version <> coalesce(v_consent.version, 0) THEN
            RETURN jsonb_build_object('success', false, 'code', 'REQUEST_CONFLICT');
        END IF;
        IF v_camp IS NOT NULL THEN
            v_eligible := private.camp_location_parent_eligible(p_actor_id, v_camp);
        ELSE
        SELECT EXISTS (
            SELECT FROM public.children ch
            JOIN public.attendance a ON a.child_id = ch.id AND a.occurrence_id = v_occurrence AND a.status = 'PRESENT'
            JOIN public.attendance_accounting aa ON aa.child_id = ch.id
                AND aa.occurrence_id = v_occurrence AND aa.qr_processed
            WHERE ch.parent_id = p_actor_id AND EXISTS (
                SELECT FROM public.enrollments e WHERE e.child_id = ch.id AND e.kind = 'COURSE'
                    AND e.entity_id = v_course AND e.status = 'ACTIVE'
            )
        ) INTO v_eligible;
        END IF;
        IF NOT v_eligible
            AND NOT (v_action = 'consent' AND p_payload->'consent' = 'false'::JSONB)
            AND NOT (v_action = 'status' AND v_consent.id IS NOT NULL) THEN
            RETURN jsonb_build_object('success', false, 'code', 'NOT_ELIGIBLE');
        END IF;
        IF v_action = 'consent' THEN
            v_now := clock_timestamp();
            IF v_now >= v_expiry THEN
                DELETE FROM public.coach_live_location_sessions WHERE id = v_session.id;
                RETURN jsonb_build_object('success', false, 'code', 'SESSION_EXPIRED');
            END IF;
            INSERT INTO public.parent_live_location_consents (session_id, parent_id, granted, version, consented_at, created_at)
                VALUES (v_session.id, p_actor_id, (p_payload->>'consent')::BOOLEAN, coalesce(v_consent.version, 0) + 1,
                    CASE WHEN p_payload->'consent' = 'true'::JSONB THEN v_now ELSE v_consent.consented_at END, v_now)
                ON CONFLICT (session_id, parent_id) DO UPDATE SET granted = EXCLUDED.granted,
                    version = EXCLUDED.version, consented_at = EXCLUDED.consented_at
                RETURNING * INTO v_consent;
            IF clock_timestamp() >= v_expiry THEN
                DELETE FROM public.coach_live_location_sessions WHERE id = v_session.id;
                RETURN jsonb_build_object('success', false, 'code', 'SESSION_EXPIRED');
            END IF;
            RETURN jsonb_build_object('success', true, 'sessionId', v_session.id, 'expiresAt', v_expiry,
                'consentVersion', v_consent.version);
        END IF;
        IF v_action <> 'status' AND NOT coalesce(v_consent.granted, false) THEN
            RETURN jsonb_build_object('success', false, 'code', 'CONSENT_REQUIRED');
        END IF;
    END IF;
    IF clock_timestamp() >= v_expiry THEN
        DELETE FROM public.coach_live_location_sessions WHERE id = v_session.id;
        RETURN jsonb_build_object('success', false, 'code', 'SESSION_EXPIRED');
    END IF;
    IF v_action = 'status' THEN
        RETURN jsonb_build_object('success', true, 'sessionId', v_session.id, 'expiresAt', v_expiry)
            || CASE WHEN v_role = 'PARENT' THEN jsonb_build_object('consentVersion', coalesce(v_consent.version, 0),
                'consentGranted', coalesce(v_consent.granted, false)) ELSE '{}'::JSONB END;
    END IF;
    SELECT * INTO v_location FROM public.coach_live_locations WHERE session_id = v_session.id;
    IF clock_timestamp() >= v_expiry THEN
        DELETE FROM public.coach_live_location_sessions WHERE id = v_session.id;
        RETURN jsonb_build_object('success', false, 'code', 'SESSION_EXPIRED');
    END IF;
    RETURN jsonb_build_object('success', true, 'sessionId', v_session.id, 'expiresAt', v_expiry,
        'location', CASE WHEN v_location.id IS NULL THEN NULL ELSE jsonb_build_object(
            'latitude', v_location.latitude, 'longitude', v_location.longitude,
            'accuracy', v_location.accuracy, 'capturedAt', v_location.captured_at,
            'updatedAt', v_location.updated_at) END);
EXCEPTION
    WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_REQUEST');
END;
$$;
