-- Prezență cu codul QR fix de la intrare, scanat de părinte (To-Do TT #395,
-- borna #20).
--
-- Fiecare antrenor are un cod de intrare printat (decizia proprietarului din
-- 12.11.2026: un cod per antrenor). Părintele îl scanează din contul lui și
-- marchează PREZENT propriul copil, doar:
--   * la cursuri (nu tabere, activități sau concursuri);
--   * pentru o ședință a unui curs al acelui antrenor, în fereastra de la
--     15 minute înainte de început până la final;
--   * pentru un copil al lui cu exact o înscriere ACTIVE la cursul ședinței și
--     cel puțin o ședință rămasă.
--
-- Contabilitatea e aceeași ca la scanarea copilului de către antrenor
-- (`record_attendance_transaction`, neschimbată): aceeași blocare pe
-- ședință+copil și același marcaj `attendance_accounting.qr_processed`. Deci
-- scanarea părintelui și a antrenorului consumă împreună cel mult o ședință, iar
-- a doua e raportată ca `duplicate`. Corecția manuală a antrenorului rămâne
-- prioritară: un ABSENT sau o ștergere manuală refuză check-in-ul cu
-- `MANUAL_OVERRIDE`, iar antrenorul poate oricând corecta după check-in
-- (ABSENT returnează ședința).
--
-- Tabelul nou `coach_entrance_codes` nu are politici și nici drepturi pentru
-- clienți: se citește și se scrie doar prin funcțiile de mai jos. Funcțiile sunt
-- SECURITY DEFINER, iau identitatea din `auth.uid()` și verifică rolul pe
-- profilul activ (`enabled`, nesters). Execuția e permisă doar rolului
-- `authenticated`. Primirile (`attendance_operations`) folosesc părintele ca
-- actor, deci reîncercarea aceleiași cereri e idempotentă.
--
-- Revenire: verificari/qr-intrare-395/revenire-00142.sql (șterge funcțiile și
-- tabelul; pontajele deja făcute de părinți rămân, sunt date reale).

CREATE TABLE public.coach_entrance_codes (
    coach_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE CHECK (token ~ '^[0-9a-f]{32}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    rotated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_entrance_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coach_entrance_codes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.coach_entrance_codes TO service_role;

CREATE FUNCTION public.entrance_code_owner(p_coach_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_role TEXT;
    v_target UUID := coalesce(p_coach_id, auth.uid());
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles
        WHERE id = auth.uid() AND enabled AND deleted_at IS NULL;
    IF v_caller_role IS NULL OR v_caller_role NOT IN ('COACH', 'ADMIN') THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;
    IF v_target <> auth.uid() AND v_caller_role <> 'ADMIN' THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;
    IF NOT EXISTS (SELECT FROM public.profiles WHERE id = v_target AND role IN ('COACH', 'ADMIN')
        AND enabled AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'COACH_NOT_FOUND';
    END IF;
    RETURN v_target;
END;
$$;

CREATE FUNCTION public.get_coach_entrance_code(p_coach_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_coach UUID;
    v_code public.coach_entrance_codes%ROWTYPE;
BEGIN
    v_coach := public.entrance_code_owner(p_coach_id);
    INSERT INTO public.coach_entrance_codes (coach_id, token)
        VALUES (v_coach, replace(gen_random_uuid()::TEXT, '-', ''))
        ON CONFLICT (coach_id) DO NOTHING;
    SELECT * INTO v_code FROM public.coach_entrance_codes WHERE coach_id = v_coach;
    RETURN jsonb_build_object('success', true, 'coachId', v_coach,
        'coachName', (SELECT name FROM public.profiles WHERE id = v_coach),
        'token', v_code.token, 'rotatedAt', v_code.rotated_at);
EXCEPTION
    WHEN raise_exception THEN
        RETURN jsonb_build_object('success', false, 'code', SQLERRM);
END;
$$;

CREATE FUNCTION public.rotate_coach_entrance_code(p_coach_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_coach UUID;
    v_code public.coach_entrance_codes%ROWTYPE;
BEGIN
    v_coach := public.entrance_code_owner(p_coach_id);
    INSERT INTO public.coach_entrance_codes (coach_id, token)
        VALUES (v_coach, replace(gen_random_uuid()::TEXT, '-', ''))
        ON CONFLICT (coach_id) DO UPDATE SET token = EXCLUDED.token, rotated_at = now()
        RETURNING * INTO v_code;
    RETURN jsonb_build_object('success', true, 'coachId', v_coach,
        'coachName', (SELECT name FROM public.profiles WHERE id = v_coach),
        'token', v_code.token, 'rotatedAt', v_code.rotated_at);
EXCEPTION
    WHEN raise_exception THEN
        RETURN jsonb_build_object('success', false, 'code', SQLERRM);
END;
$$;

CREATE FUNCTION public.entrance_checkin_options(p_token TEXT)
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
            min(e.remaining_sessions) AS remaining_sessions
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
                WHEN x.remaining_sessions <= 0 THEN 'NO_REMAINING_SESSIONS'
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

CREATE FUNCTION public.entrance_checkin(p_token TEXT, p_occurrence_id UUID, p_child_id UUID, p_request_id UUID)
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
            IF v_enrollment.remaining_sessions <= 0 THEN
                RAISE EXCEPTION 'NO_REMAINING_SESSIONS';
            END IF;
            UPDATE public.enrollments SET remaining_sessions = remaining_sessions - 1,
                sessions_used = sessions_used + 1 WHERE id = v_enrollment.id;
            INSERT INTO public.attendance (occurrence_id, child_id, status)
                VALUES (p_occurrence_id, p_child_id, 'PRESENT')
                ON CONFLICT (occurrence_id, child_id) DO UPDATE SET status = EXCLUDED.status;
            v_accounting.debit_enrollment_id := v_enrollment.id;
            v_changed := true;
        END IF;
        UPDATE public.attendance_accounting SET
            debit_enrollment_id = v_accounting.debit_enrollment_id,
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
            (SELECT remaining_sessions FROM public.enrollments WHERE id = v_enrollments[1]) END);
    INSERT INTO public.attendance_operations (actor_id, request_id, payload_hash, result)
        VALUES (v_parent, p_request_id, v_hash, v_result);
    RETURN v_result;
EXCEPTION
    WHEN raise_exception THEN
        RETURN jsonb_build_object('success', false, 'code', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.entrance_code_owner(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_coach_entrance_code(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rotate_coach_entrance_code(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.entrance_checkin_options(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.entrance_checkin(TEXT, UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_coach_entrance_code(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rotate_coach_entrance_code(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.entrance_checkin_options(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.entrance_checkin(TEXT, UUID, UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.entrance_code_owner(UUID) TO service_role;
