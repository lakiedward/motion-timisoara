-- Feature TT #698, part 2 of 2 (after 00150): every attendance path takes a
-- "Prezent" from the package valid on the session's Bucharest date that
-- expires first, then from the never-expiring sessions, and an undo gives it
-- back to the same package. Coach manual and bulk, club manual and scan go
-- through record_attendance_transaction; the parent's entrance code through
-- entrance_checkin and entrance_checkin_options.
--
-- Replaced functions are checked against their live md5 first: 00144
-- record_attendance_transaction, 00142 entrance_checkin(_options).

DO $guard$
DECLARE
    v_expected CONSTANT JSONB := jsonb_build_object(
        'record_attendance_transaction', '013184e07a7ae6ff032a191f3f19a0e3',
        'entrance_checkin', '17f742729a65c59be145f37e9ecc2a17',
        'entrance_checkin_options', 'ae86b99a987605b2351f1ede9baa0156');
    v_name TEXT;
    v_md5 TEXT;
BEGIN
    IF to_regclass('public.enrollment_monthly_packages') IS NULL THEN
        RAISE EXCEPTION 'apply 00150 first';
    END IF;
    FOR v_name IN SELECT jsonb_object_keys(v_expected) LOOP
        SELECT md5(p.prosrc) INTO v_md5 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = v_name;
        IF v_md5 IS DISTINCT FROM v_expected->>v_name THEN
            RAISE EXCEPTION '% differs from the reviewed source (md5 %); stop and compare', v_name, v_md5;
        END IF;
    END LOOP;
END
$guard$;

CREATE OR REPLACE FUNCTION public.record_attendance_transaction(p_actor_id UUID, p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_request UUID;
    v_occurrence UUID;
    v_course UUID;
    v_coach UUID;
    v_club_owner UUID;
    v_starts TIMESTAMPTZ;
    v_role TEXT;
    v_status TEXT;
    v_qr TEXT;
    v_bulk BOOLEAN;
    v_children UUID[];
    v_child UUID;
    v_name TEXT;
    v_previous TEXT;
    v_hash TEXT;
    v_receipt public.attendance_operations%ROWTYPE;
    v_accounting public.attendance_accounting%ROWTYPE;
    v_enrollment public.enrollments%ROWTYPE;
    v_enrollments UUID[];
    v_result JSONB;
    v_changed BOOLEAN := false;
BEGIN
    IF p_actor_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
        OR NOT (p_payload ? 'status') THEN
        RAISE EXCEPTION 'INVALID_REQUEST';
    END IF;
    v_request := (p_payload->>'requestId')::UUID;
    v_occurrence := (p_payload->>'occurrenceId')::UUID;
    v_status := p_payload->>'status';
    v_qr := p_payload->>'qrToken';
    v_bulk := p_payload ? 'childIds';
    IF v_request IS NULL OR v_occurrence IS NULL
        OR (v_status IS NOT NULL AND v_status NOT IN ('PRESENT', 'ABSENT'))
        OR (v_qr IS NOT NULL AND (v_qr !~ '^[0-9a-f]{32}$' OR v_status IS DISTINCT FROM 'PRESENT'))
        OR (v_bulk AND (v_status IS DISTINCT FROM 'PRESENT' OR p_payload->'onlyUnmarked' IS DISTINCT FROM 'true'::JSONB))
        OR ((p_payload ? 'childId')::INTEGER + (p_payload ? 'qrToken')::INTEGER + v_bulk::INTEGER <> 1) THEN
        RAISE EXCEPTION 'INVALID_REQUEST';
    END IF;
    SELECT role INTO v_role FROM public.profiles
        WHERE id = p_actor_id AND enabled FOR SHARE;
    IF v_role IS NULL OR v_role NOT IN ('COACH', 'CLUB', 'ADMIN') THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_actor_id::TEXT || ':' || v_request::TEXT, 0));
    v_hash := md5(p_payload::TEXT);
    SELECT o.course_id, c.coach_id, o.starts_at,
            (SELECT cl.owner_user_id FROM public.clubs cl
                WHERE cl.id = c.club_id AND cl.approved_at IS NOT NULL)
        INTO v_course, v_coach, v_starts, v_club_owner
        FROM public.course_occurrences o JOIN public.courses c ON c.id = o.course_id
        WHERE o.id = v_occurrence FOR SHARE OF o, c;
    IF NOT FOUND THEN
        RAISE EXCEPTION '%', CASE WHEN v_role = 'CLUB' THEN 'FORBIDDEN' ELSE 'OCCURRENCE_NOT_FOUND' END;
    END IF;
    IF v_role = 'COACH' AND v_coach <> p_actor_id THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;
    IF v_role = 'CLUB' AND (v_club_owner IS DISTINCT FROM p_actor_id OR v_qr IS NOT NULL) THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;
    SELECT * INTO v_receipt FROM public.attendance_operations
        WHERE actor_id = p_actor_id AND request_id = v_request;
    IF FOUND THEN
        IF v_receipt.payload_hash <> v_hash THEN
            RAISE EXCEPTION 'REQUEST_CONFLICT';
        END IF;
        RETURN v_receipt.result;
    END IF;
    IF v_status IS NOT NULL AND clock_timestamp() < v_starts THEN
        RAISE EXCEPTION 'TOO_EARLY';
    END IF;
    IF v_qr IS NOT NULL THEN
        SELECT id, name INTO v_child, v_name FROM public.children WHERE qr_token = v_qr FOR SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'INVALID_QR';
        END IF;
        v_children := ARRAY[v_child];
    ELSIF v_bulk THEN
        IF jsonb_typeof(p_payload->'childIds') IS DISTINCT FROM 'array'
            OR jsonb_array_length(p_payload->'childIds') NOT BETWEEN 1 AND 200 THEN
            RAISE EXCEPTION 'INVALID_REQUEST';
        END IF;
        SELECT array_agg(DISTINCT value::UUID ORDER BY value::UUID) INTO v_children
            FROM jsonb_array_elements_text(p_payload->'childIds');
    ELSE
        v_children := ARRAY[(p_payload->>'childId')::UUID];
    END IF;
    FOREACH v_child IN ARRAY v_children LOOP
        IF v_child IS NULL THEN
            RAISE EXCEPTION 'INVALID_REQUEST';
        END IF;
        PERFORM pg_advisory_xact_lock(hashtextextended(v_occurrence::TEXT || ':' || v_child::TEXT, 1));
        SELECT name INTO v_name FROM public.children WHERE id = v_child FOR SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'CHILD_NOT_FOUND';
        END IF;
        SELECT status INTO v_previous FROM public.attendance
            WHERE occurrence_id = v_occurrence AND child_id = v_child FOR UPDATE;
        IF v_bulk AND v_previous IS NOT NULL THEN
            CONTINUE;
        END IF;
        INSERT INTO public.attendance_accounting (occurrence_id, child_id)
            VALUES (v_occurrence, v_child) ON CONFLICT (occurrence_id, child_id) DO NOTHING;
        SELECT * INTO v_accounting FROM public.attendance_accounting
            WHERE occurrence_id = v_occurrence AND child_id = v_child FOR UPDATE;
        IF v_qr IS NOT NULL AND v_accounting.qr_processed THEN
            CONTINUE;
        END IF;
        IF v_qr IS NOT NULL AND (v_previous = 'ABSENT' OR
            (v_accounting.manual_override AND v_previous IS DISTINCT FROM 'PRESENT')) THEN
            RAISE EXCEPTION 'MANUAL_OVERRIDE';
        END IF;
        SELECT array_agg(e.id ORDER BY e.id) INTO v_enrollments FROM (
            SELECT id FROM public.enrollments
                WHERE kind = 'COURSE' AND entity_id = v_course AND child_id = v_child AND status = 'ACTIVE'
                ORDER BY id FOR UPDATE
        ) e;
        IF coalesce(cardinality(v_enrollments), 0) = 0 THEN
            RAISE EXCEPTION 'NOT_ENROLLED';
        END IF;
        IF cardinality(v_enrollments) <> 1 THEN
            RAISE EXCEPTION 'AMBIGUOUS_ENROLLMENT';
        END IF;
        SELECT * INTO v_enrollment FROM public.enrollments WHERE id = v_enrollments[1];
        IF v_enrollment.remaining_sessions < 0 OR v_enrollment.sessions_used < 0 THEN
            RAISE EXCEPTION 'INVALID_BALANCE';
        END IF;
        IF v_status = 'PRESENT' AND v_previous IS DISTINCT FROM 'PRESENT' THEN
            v_accounting.debit_monthly_package_id :=
                public.course_session_debit(v_enrollment.id, public.bucharest_date(v_starts));
            v_accounting.debit_enrollment_id := v_enrollment.id;
        ELSIF v_status IS DISTINCT FROM 'PRESENT' AND v_accounting.debit_enrollment_id IS NOT NULL THEN
            PERFORM public.course_session_credit(v_accounting.debit_enrollment_id,
                v_accounting.debit_monthly_package_id);
            v_accounting.debit_enrollment_id := NULL;
            v_accounting.debit_monthly_package_id := NULL;
        END IF;
        IF v_qr IS NULL OR v_previous IS DISTINCT FROM 'PRESENT' THEN
            IF v_status IS NULL THEN
                DELETE FROM public.attendance WHERE occurrence_id = v_occurrence AND child_id = v_child;
            ELSE
                INSERT INTO public.attendance (occurrence_id, child_id, status)
                    VALUES (v_occurrence, v_child, v_status)
                    ON CONFLICT (occurrence_id, child_id) DO UPDATE SET status = EXCLUDED.status;
            END IF;
            v_changed := true;
        END IF;
        UPDATE public.attendance_accounting SET
            debit_enrollment_id = v_accounting.debit_enrollment_id,
            debit_monthly_package_id = v_accounting.debit_monthly_package_id,
            manual_override = manual_override OR v_qr IS NULL,
            qr_processed = qr_processed OR v_qr IS NOT NULL,
            updated_at = now()
            WHERE id = v_accounting.id;
    END LOOP;
    v_result := jsonb_build_object('success', true, 'outcome', CASE WHEN v_changed THEN 'recorded' ELSE 'duplicate' END);
    IF NOT v_bulk THEN
        v_result := v_result || jsonb_build_object('childName', v_name);
    END IF;
    INSERT INTO public.attendance_operations (actor_id, request_id, payload_hash, result)
        VALUES (p_actor_id, v_request, v_hash, v_result);
    RETURN v_result;
EXCEPTION
    WHEN raise_exception THEN
        RETURN jsonb_build_object('success', false, 'code', SQLERRM);
    WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_REQUEST');
END;
$$;


CREATE OR REPLACE FUNCTION public.entrance_checkin_options(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_parent UUID := auth.uid();
    v_coach UUID;
    v_coach_name TEXT;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_options JSONB;
    v_next TIMESTAMPTZ;
BEGIN
    IF p_token IS NULL OR p_token !~ '^[0-9a-f]{32}$' THEN
        RAISE EXCEPTION 'INVALID_CODE';
    END IF;
    IF NOT EXISTS (SELECT FROM public.profiles WHERE id = v_parent AND role = 'PARENT'
        AND enabled AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;
    SELECT k.coach_id, p.name INTO v_coach, v_coach_name
        FROM public.coach_entrance_codes k JOIN public.profiles p ON p.id = k.coach_id
        WHERE k.token = p_token AND p.role IN ('COACH', 'ADMIN') AND p.enabled AND p.deleted_at IS NULL;
    IF v_coach IS NULL THEN
        RAISE EXCEPTION 'INVALID_CODE';
    END IF;
    WITH eligible AS (
        SELECT o.id AS occurrence_id, c.id AS course_id, c.name AS course_name,
            o.starts_at, o.ends_at, ch.id AS child_id, ch.name AS child_name,
            count(e.id) AS active_enrollments,
            min(public.course_sessions_available(e.id, public.bucharest_date(o.starts_at))) AS remaining_sessions,
            min(public.course_session_shortage(e.id, public.bucharest_date(o.starts_at))) AS shortage
        FROM public.course_occurrences o
        JOIN public.courses c ON c.id = o.course_id
        JOIN public.enrollments e ON e.kind = 'COURSE' AND e.entity_id = c.id AND e.status = 'ACTIVE'
        JOIN public.children ch ON ch.id = e.child_id AND ch.parent_id = v_parent
        WHERE c.coach_id = v_coach
            AND v_now >= o.starts_at - INTERVAL '15 minutes' AND v_now <= o.ends_at
        GROUP BY o.id, c.id, c.name, o.starts_at, o.ends_at, ch.id, ch.name
    )
    SELECT jsonb_agg(jsonb_build_object(
            'occurrenceId', x.occurrence_id, 'courseId', x.course_id, 'courseName', x.course_name,
            'startsAt', x.starts_at, 'endsAt', x.ends_at,
            'childId', x.child_id, 'childName', x.child_name,
            'remainingSessions', CASE WHEN x.active_enrollments = 1 THEN x.remaining_sessions END,
            'state', CASE
                WHEN a.status = 'PRESENT' THEN 'ALREADY_PRESENT'
                WHEN a.status = 'ABSENT' OR coalesce(acc.manual_override, false) THEN 'MANUAL_OVERRIDE'
                WHEN coalesce(acc.qr_processed, false) THEN 'ALREADY_PRESENT'
                WHEN x.active_enrollments <> 1 THEN 'AMBIGUOUS_ENROLLMENT'
                WHEN x.remaining_sessions <= 0 THEN coalesce(x.shortage, 'NO_REMAINING_SESSIONS')
                ELSE 'AVAILABLE' END)
        ORDER BY x.starts_at, x.course_name, x.child_name, x.child_id)
        INTO v_options
        FROM eligible x
        LEFT JOIN public.attendance a ON a.occurrence_id = x.occurrence_id AND a.child_id = x.child_id
        LEFT JOIN public.attendance_accounting acc
            ON acc.occurrence_id = x.occurrence_id AND acc.child_id = x.child_id;
    IF v_options IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'coachName', v_coach_name,
            'serverTime', v_now, 'options', v_options);
    END IF;
    IF NOT EXISTS (
        SELECT FROM public.enrollments e
        JOIN public.courses c ON c.id = e.entity_id
        JOIN public.children ch ON ch.id = e.child_id AND ch.parent_id = v_parent
        WHERE e.kind = 'COURSE' AND e.status = 'ACTIVE' AND c.coach_id = v_coach
    ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_ENROLLED', 'coachName', v_coach_name);
    END IF;
    SELECT min(o.starts_at) - INTERVAL '15 minutes' INTO v_next
        FROM public.course_occurrences o
        JOIN public.courses c ON c.id = o.course_id
        JOIN public.enrollments e ON e.kind = 'COURSE' AND e.entity_id = c.id AND e.status = 'ACTIVE'
        JOIN public.children ch ON ch.id = e.child_id AND ch.parent_id = v_parent
        WHERE c.coach_id = v_coach AND o.starts_at - INTERVAL '15 minutes' > v_now;
    RETURN jsonb_build_object('success', false, 'code', 'OUTSIDE_WINDOW', 'coachName', v_coach_name,
        'serverTime', v_now, 'nextOpensAt', v_next);
EXCEPTION
    WHEN raise_exception THEN
        RETURN jsonb_build_object('success', false, 'code', SQLERRM);
END;
$$;


CREATE OR REPLACE FUNCTION public.entrance_checkin(p_token TEXT, p_occurrence_id UUID, p_child_id UUID, p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_parent UUID := auth.uid();
    v_coach UUID;
    v_course UUID;
    v_course_name TEXT;
    v_course_coach UUID;
    v_starts TIMESTAMPTZ;
    v_ends TIMESTAMPTZ;
    v_now TIMESTAMPTZ;
    v_child_name TEXT;
    v_previous TEXT;
    v_hash TEXT;
    v_receipt public.attendance_operations%ROWTYPE;
    v_accounting public.attendance_accounting%ROWTYPE;
    v_enrollment public.enrollments%ROWTYPE;
    v_enrollments UUID[];
    v_changed BOOLEAN := false;
    v_result JSONB;
BEGIN
    IF p_occurrence_id IS NULL OR p_child_id IS NULL OR p_request_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_REQUEST';
    END IF;
    IF p_token IS NULL OR p_token !~ '^[0-9a-f]{32}$' THEN
        RAISE EXCEPTION 'INVALID_CODE';
    END IF;
    PERFORM FROM public.profiles WHERE id = v_parent AND role = 'PARENT'
        AND enabled AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_parent::TEXT || ':' || p_request_id::TEXT, 0));
    v_hash := md5(jsonb_build_object('entrance', true, 'occurrenceId', p_occurrence_id,
        'childId', p_child_id)::TEXT);
    SELECT k.coach_id INTO v_coach
        FROM public.coach_entrance_codes k JOIN public.profiles p ON p.id = k.coach_id
        WHERE k.token = p_token AND p.role IN ('COACH', 'ADMIN') AND p.enabled AND p.deleted_at IS NULL;
    IF v_coach IS NULL THEN
        RAISE EXCEPTION 'INVALID_CODE';
    END IF;
    SELECT o.course_id, c.name, c.coach_id, o.starts_at, o.ends_at
        INTO v_course, v_course_name, v_course_coach, v_starts, v_ends
        FROM public.course_occurrences o JOIN public.courses c ON c.id = o.course_id
        WHERE o.id = p_occurrence_id FOR SHARE OF o, c;
    IF NOT FOUND OR v_course_coach <> v_coach THEN
        RAISE EXCEPTION 'OCCURRENCE_NOT_FOUND';
    END IF;
    SELECT name INTO v_child_name FROM public.children
        WHERE id = p_child_id AND parent_id = v_parent FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'CHILD_NOT_FOUND';
    END IF;
    SELECT * INTO v_receipt FROM public.attendance_operations
        WHERE actor_id = v_parent AND request_id = p_request_id;
    IF FOUND THEN
        IF v_receipt.payload_hash <> v_hash THEN
            RAISE EXCEPTION 'REQUEST_CONFLICT';
        END IF;
        RETURN v_receipt.result;
    END IF;
    v_now := clock_timestamp();
    IF v_now < v_starts - INTERVAL '15 minutes' OR v_now > v_ends THEN
        RAISE EXCEPTION 'OUTSIDE_WINDOW';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_occurrence_id::TEXT || ':' || p_child_id::TEXT, 1));
    SELECT status INTO v_previous FROM public.attendance
        WHERE occurrence_id = p_occurrence_id AND child_id = p_child_id FOR UPDATE;
    INSERT INTO public.attendance_accounting (occurrence_id, child_id)
        VALUES (p_occurrence_id, p_child_id) ON CONFLICT (occurrence_id, child_id) DO NOTHING;
    SELECT * INTO v_accounting FROM public.attendance_accounting
        WHERE occurrence_id = p_occurrence_id AND child_id = p_child_id FOR UPDATE;
    SELECT array_agg(e.id ORDER BY e.id) INTO v_enrollments FROM (
        SELECT id FROM public.enrollments
            WHERE kind = 'COURSE' AND entity_id = v_course AND child_id = p_child_id AND status = 'ACTIVE'
            ORDER BY id FOR UPDATE
    ) e;
    IF coalesce(cardinality(v_enrollments), 0) = 0 THEN
        RAISE EXCEPTION 'NOT_ENROLLED';
    END IF;
    IF v_previous = 'ABSENT' OR (v_accounting.manual_override AND v_previous IS DISTINCT FROM 'PRESENT') THEN
        RAISE EXCEPTION 'MANUAL_OVERRIDE';
    END IF;
    IF NOT v_accounting.qr_processed THEN
        IF cardinality(v_enrollments) <> 1 THEN
            RAISE EXCEPTION 'AMBIGUOUS_ENROLLMENT';
        END IF;
        SELECT * INTO v_enrollment FROM public.enrollments WHERE id = v_enrollments[1];
        IF v_enrollment.remaining_sessions < 0 OR v_enrollment.sessions_used < 0 THEN
            RAISE EXCEPTION 'INVALID_BALANCE';
        END IF;
        IF v_previous IS DISTINCT FROM 'PRESENT' THEN
            v_accounting.debit_monthly_package_id :=
                public.course_session_debit(v_enrollment.id, public.bucharest_date(v_starts));
            INSERT INTO public.attendance (occurrence_id, child_id, status)
                VALUES (p_occurrence_id, p_child_id, 'PRESENT')
                ON CONFLICT (occurrence_id, child_id) DO UPDATE SET status = EXCLUDED.status;
            v_accounting.debit_enrollment_id := v_enrollment.id;
            v_changed := true;
        END IF;
        UPDATE public.attendance_accounting SET
            debit_enrollment_id = v_accounting.debit_enrollment_id,
            debit_monthly_package_id = v_accounting.debit_monthly_package_id,
            qr_processed = true,
            updated_at = now()
            WHERE id = v_accounting.id;
    END IF;
    v_result := jsonb_build_object('success', true,
        'outcome', CASE WHEN v_changed THEN 'recorded' ELSE 'duplicate' END,
        'occurrenceId', p_occurrence_id, 'childId', p_child_id,
        'childName', v_child_name, 'courseName', v_course_name, 'startsAt', v_starts,
        'attendanceStatus', (SELECT status FROM public.attendance
            WHERE occurrence_id = p_occurrence_id AND child_id = p_child_id),
        'remainingSessions', CASE WHEN cardinality(v_enrollments) = 1 THEN
            public.course_sessions_available(v_enrollments[1], public.bucharest_date(v_starts)) END);
    INSERT INTO public.attendance_operations (actor_id, request_id, payload_hash, result)
        VALUES (v_parent, p_request_id, v_hash, v_result);
    RETURN v_result;
EXCEPTION
    WHEN raise_exception THEN
        RETURN jsonb_build_object('success', false, 'code', SQLERRM);
END;
$$;

NOTIFY pgrst, 'reload schema';
