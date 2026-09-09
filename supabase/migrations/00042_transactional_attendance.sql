CREATE TABLE public.attendance_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    payload_hash TEXT NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (actor_id, request_id)
);

CREATE TABLE public.attendance_accounting (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id UUID NOT NULL REFERENCES public.course_occurrences(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    debit_enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE RESTRICT,
    manual_override BOOLEAN NOT NULL DEFAULT false,
    qr_processed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (occurrence_id, child_id)
);

ALTER TABLE public.attendance_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_accounting ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_operations, public.attendance_accounting FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.attendance_operations, public.attendance_accounting TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.attendance FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS attendance_insert ON public.attendance;
DROP POLICY IF EXISTS attendance_update ON public.attendance;
DROP POLICY IF EXISTS attendance_delete ON public.attendance;

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
    IF v_role IS NULL OR v_role NOT IN ('COACH', 'ADMIN') THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_actor_id::TEXT || ':' || v_request::TEXT, 0));
    v_hash := md5(p_payload::TEXT);
    SELECT o.course_id, c.coach_id INTO v_course, v_coach
        FROM public.course_occurrences o JOIN public.courses c ON c.id = o.course_id
        WHERE o.id = v_occurrence FOR SHARE OF o, c;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'OCCURRENCE_NOT_FOUND';
    END IF;
    IF v_role = 'COACH' AND v_coach <> p_actor_id THEN
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
            IF v_enrollment.remaining_sessions <= 0 THEN
                RAISE EXCEPTION 'NO_REMAINING_SESSIONS';
            END IF;
            UPDATE public.enrollments SET remaining_sessions = remaining_sessions - 1,
                sessions_used = sessions_used + 1 WHERE id = v_enrollment.id;
            v_accounting.debit_enrollment_id := v_enrollment.id;
        ELSIF v_status IS DISTINCT FROM 'PRESENT' AND v_accounting.debit_enrollment_id IS NOT NULL THEN
            UPDATE public.enrollments SET remaining_sessions = remaining_sessions + 1,
                sessions_used = sessions_used - 1
                WHERE id = v_accounting.debit_enrollment_id AND sessions_used > 0;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'INVALID_BALANCE';
            END IF;
            v_accounting.debit_enrollment_id := NULL;
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

REVOKE ALL ON FUNCTION public.record_attendance_transaction(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_attendance_transaction(UUID, JSONB) TO service_role;
