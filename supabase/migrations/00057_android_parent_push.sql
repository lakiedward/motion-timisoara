CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE public.push_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.push_devices (
    id UUID PRIMARY KEY,
    installation_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    token TEXT NOT NULL CHECK (length(token) BETWEEN 20 AND 4096 AND token !~ '[[:space:]]'),
    platform TEXT NOT NULL DEFAULT 'android' CHECK (platform = 'android'),
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX push_devices_active_token_idx ON public.push_devices(token) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX push_devices_active_installation_idx ON public.push_devices(installation_id) WHERE revoked_at IS NULL;
CREATE INDEX push_devices_user_idx ON public.push_devices(user_id) WHERE revoked_at IS NULL;
ALTER TABLE public.push_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_preferences, public.push_devices FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.push_preferences TO authenticated;
GRANT SELECT (id, installation_id, user_id, platform, revoked_at, created_at, updated_at) ON public.push_devices TO authenticated;
CREATE POLICY push_preferences_owner ON public.push_preferences FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY push_devices_owner ON public.push_devices FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE TABLE private.push_binding_revocations (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE private.push_course_publications (
    id UUID PRIMARY KEY REFERENCES public.courses(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO private.push_course_publications(id) SELECT id FROM public.courses WHERE active AND club_id IS NOT NULL;
CREATE TABLE private.push_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL CHECK (source_type IN ('course_announcement', 'club_announcement', 'attendance', 'course', 'camp')),
    source_id UUID NOT NULL,
    context JSONB NOT NULL DEFAULT '{}'::JSONB,
    not_before TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours',
    expanded_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX push_events_initial_idx ON private.push_events(source_type, source_id) WHERE source_type <> 'attendance';
CREATE INDEX push_events_due_idx ON private.push_events(not_before) WHERE expanded_at IS NULL AND cancelled_at IS NULL;
CREATE TABLE private.push_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES private.push_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    binding_id UUID NOT NULL REFERENCES public.push_devices(id) ON DELETE CASCADE,
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sending', 'sent', 'skipped', 'dead')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    lease_id UUID,
    lease_until TIMESTAMPTZ,
    token_hash TEXT,
    outcome_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, user_id, binding_id)
);
CREATE INDEX push_deliveries_ready_idx ON private.push_deliveries(available_at) WHERE state IN ('pending', 'sending');
ALTER TABLE private.push_binding_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.push_course_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.push_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.push_binding_revocations, private.push_course_publications, private.push_events, private.push_deliveries FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.require_push_parent() RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := auth.uid(); v_session UUID := (auth.jwt()->>'session_id')::UUID;
BEGIN
    IF v_user IS NULL OR v_session IS NULL OR NOT EXISTS (
        SELECT FROM public.profiles p JOIN auth.sessions s ON s.user_id = p.id
        WHERE p.id = v_user AND p.enabled AND p.role = 'PARENT' AND s.id = v_session
          AND (s.not_after IS NULL OR s.not_after > now())
    ) THEN RAISE EXCEPTION 'Valid parent session required' USING ERRCODE = '42501'; END IF;
    RETURN v_user;
END;
$$;
CREATE FUNCTION public.get_my_push_preferences() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := private.require_push_parent();
BEGIN
    RETURN jsonb_build_object('enabled', COALESCE((SELECT enabled FROM public.push_preferences WHERE user_id = v_user), false));
END;
$$;
CREATE FUNCTION public.set_my_push_enabled(p_enabled BOOLEAN) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := private.require_push_parent();
BEGIN
    IF p_enabled IS NULL THEN RAISE EXCEPTION 'Invalid preference' USING ERRCODE = '22023'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('push-user:' || v_user::TEXT, 0));
    INSERT INTO public.push_preferences(user_id, enabled) VALUES (v_user, p_enabled)
    ON CONFLICT (user_id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();
    IF NOT p_enabled THEN
        UPDATE public.push_devices SET revoked_at = now(), updated_at = now() WHERE user_id = v_user AND revoked_at IS NULL;
    END IF;
    RETURN jsonb_build_object('enabled', p_enabled);
END;
$$;
CREATE FUNCTION public.register_push_device(p_installation_id UUID, p_binding_id UUID, p_token TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := private.require_push_parent(); v_existing public.push_devices; v_lock TEXT;
BEGIN
    IF p_installation_id IS NULL OR p_binding_id IS NULL OR p_token IS NULL
       OR length(p_token) NOT BETWEEN 20 AND 4096 OR p_token ~ '[[:space:]]' THEN
        RAISE EXCEPTION 'Invalid device registration' USING ERRCODE = '22023';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('push-user:' || v_user::TEXT, 0));
    FOR v_lock IN SELECT unnest(ARRAY['push-binding:' || p_binding_id::TEXT, 'push-installation:' || p_installation_id::TEXT, 'push-token:' || md5(p_token)]) ORDER BY 1 LOOP
        PERFORM pg_advisory_xact_lock(hashtextextended(v_lock, 0));
    END LOOP;
    IF NOT COALESCE((SELECT enabled FROM public.push_preferences WHERE user_id = v_user), false) THEN
        RAISE EXCEPTION 'Push is disabled' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_existing FROM public.push_devices WHERE id = p_binding_id FOR UPDATE;
    IF EXISTS (SELECT FROM private.push_binding_revocations WHERE id = p_binding_id)
       OR (FOUND AND (v_existing.user_id <> v_user OR v_existing.installation_id <> p_installation_id
           OR v_existing.session_id <> (auth.jwt()->>'session_id')::UUID OR v_existing.revoked_at IS NOT NULL)) THEN
        RAISE EXCEPTION 'New device binding required' USING ERRCODE = '42501';
    END IF;
    UPDATE public.push_devices SET revoked_at = now(), updated_at = now()
    WHERE id <> p_binding_id AND revoked_at IS NULL AND (installation_id = p_installation_id OR token = p_token);
    INSERT INTO public.push_devices(id, installation_id, user_id, session_id, token)
    VALUES (p_binding_id, p_installation_id, v_user, (auth.jwt()->>'session_id')::UUID, p_token)
    ON CONFLICT (id) DO UPDATE SET token = EXCLUDED.token, updated_at = now();
END;
$$;
CREATE FUNCTION public.revoke_push_device(p_binding_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := auth.uid();
BEGIN
    IF v_user IS NULL OR p_binding_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('push-binding:' || p_binding_id::TEXT, 0));
    IF EXISTS (SELECT FROM public.push_devices WHERE id = p_binding_id AND user_id <> v_user) THEN RETURN; END IF;
    INSERT INTO private.push_binding_revocations(id, user_id) VALUES (p_binding_id, v_user) ON CONFLICT DO NOTHING;
    UPDATE public.push_devices SET revoked_at = COALESCE(revoked_at, now()), updated_at = now()
    WHERE id = p_binding_id AND user_id = v_user;
END;
$$;

CREATE FUNCTION private.push_message(p_event private.push_events, p_user UUID) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_course UUID; v_club UUID; v_child UUID; v_kind TEXT; v_path TEXT; v_entity UUID;
    v_audience TEXT; v_audience_id UUID; v_slug TEXT; v_found BOOLEAN := false;
BEGIN
    IF p_event.cancelled_at IS NOT NULL OR p_event.not_before > now() OR p_event.expires_at <= now() THEN RETURN NULL; END IF;
    IF p_event.source_type = 'course_announcement' THEN
        SELECT course_id INTO v_course FROM public.course_announcements WHERE id = p_event.source_id AND created_at <= now();
        v_found := FOUND; v_kind := 'announcement'; v_path := '/account/announcements'; v_entity := p_event.source_id;
    ELSIF p_event.source_type = 'club_announcement' THEN
        SELECT club_id, audience_kind, audience_id INTO v_club, v_audience, v_audience_id
        FROM public.club_announcements WHERE id = p_event.source_id AND is_active
          AND (publish_at IS NULL OR publish_at <= now()) AND (expires_at IS NULL OR expires_at > now());
        v_found := FOUND; v_kind := 'announcement'; v_path := '/account/announcements'; v_entity := p_event.source_id;
        IF v_found AND v_audience <> 'CLUB' AND public.audience_club_id(v_audience, v_audience_id) IS DISTINCT FROM v_club THEN RETURN NULL; END IF;
    ELSIF p_event.source_type = 'attendance' THEN
        SELECT a.child_id, o.course_id INTO v_child, v_course FROM public.attendance a
        JOIN public.course_occurrences o ON o.id = a.occurrence_id
        WHERE a.id = p_event.source_id AND a.status = p_event.context->>'status';
        v_found := FOUND; v_kind := 'attendance'; v_path := '/account/attendance'; v_entity := p_event.source_id;
    ELSIF p_event.source_type = 'course' THEN
        SELECT club_id INTO v_club FROM public.courses WHERE id = p_event.source_id AND active
          AND club_id = (p_event.context->>'clubId')::UUID;
        v_found := FOUND; v_kind := 'course'; v_path := '/cursuri/' || p_event.source_id::TEXT; v_entity := p_event.source_id;
    ELSIF p_event.source_type = 'camp' THEN
        SELECT club_id, slug INTO v_club, v_slug FROM public.camps WHERE id = p_event.source_id
          AND club_id = (p_event.context->>'clubId')::UUID AND period_end >= (now() AT TIME ZONE 'Europe/Bucharest')::DATE;
        v_found := FOUND; v_kind := 'camp'; v_path := CASE WHEN length(v_slug) > 2000 THEN '/tabere' ELSE '/tabere/' || v_slug END; v_entity := p_event.source_id;
        IF v_slug IS NULL OR v_slug !~ '^[a-z0-9-]{3,}$' THEN RETURN NULL; END IF;
    END IF;
    IF NOT v_found OR NOT EXISTS (
        SELECT FROM public.enrollments e JOIN public.children ch ON ch.id = e.child_id
        WHERE ch.parent_id = p_user AND e.status = 'ACTIVE'
          AND (v_child IS NULL OR ch.id = v_child)
          AND CASE WHEN v_course IS NOT NULL THEN e.kind = 'COURSE' AND e.entity_id = v_course
              ELSE v_club IS NOT NULL AND public.audience_club_id(e.kind, e.entity_id) = v_club
                  AND (v_audience IS NULL OR v_audience = 'CLUB' OR (e.kind = v_audience AND e.entity_id = v_audience_id)) END
    ) THEN RETURN NULL; END IF;
    RETURN jsonb_build_object('eventId', p_event.id::TEXT, 'kind', v_kind, 'entityId', v_entity::TEXT, 'path', v_path,
        'title', CASE v_kind WHEN 'announcement' THEN 'Anunț nou' WHEN 'attendance' THEN 'Prezență actualizată'
            WHEN 'course' THEN 'Curs nou' ELSE 'Tabără nouă' END,
        'body', CASE v_kind WHEN 'announcement' THEN 'Ai un anunț nou în Motion. Deschide aplicația pentru detalii.'
            WHEN 'attendance' THEN 'Prezența a fost actualizată. Deschide aplicația pentru detalii.'
            WHEN 'course' THEN 'Clubul a adăugat un curs. Deschide aplicația pentru detalii.'
            ELSE 'Clubul a adăugat o tabără. Deschide aplicația pentru detalii.' END,
        'expiresAt', floor(extract(epoch FROM p_event.expires_at) * 1000)::BIGINT::TEXT);
END;
$$;

CREATE FUNCTION private.capture_push_event() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_type TEXT := TG_ARGV[0]; v_due TIMESTAMPTZ := now(); v_expiry TIMESTAMPTZ := now() + interval '24 hours'; v_context JSONB := '{}'::JSONB;
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE private.push_events SET cancelled_at = now() WHERE source_type = v_type AND source_id = OLD.id AND cancelled_at IS NULL;
        RETURN OLD;
    END IF;
    IF v_type = 'attendance' THEN
        IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status
            AND NEW.child_id IS NOT DISTINCT FROM OLD.child_id AND NEW.occurrence_id IS NOT DISTINCT FROM OLD.occurrence_id THEN RETURN NEW; END IF;
        UPDATE private.push_events SET cancelled_at = now() WHERE source_type = v_type AND source_id = NEW.id AND cancelled_at IS NULL;
        INSERT INTO private.push_events(source_type, source_id, context, expires_at)
        VALUES (v_type, NEW.id, jsonb_build_object('status', NEW.status), now() + interval '1 hour');
        RETURN NEW;
    END IF;
    IF v_type = 'course' THEN
        IF NOT NEW.active OR NEW.club_id IS NULL THEN RETURN NEW; END IF;
        IF TG_OP = 'UPDATE' THEN
            IF OLD.active AND OLD.club_id IS NOT NULL THEN RETURN NEW; END IF;
        END IF;
        INSERT INTO private.push_course_publications(id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
        IF NOT FOUND THEN RETURN NEW; END IF;
        INSERT INTO private.push_events(source_type, source_id, context)
        VALUES ('course', NEW.id, jsonb_build_object('clubId', NEW.club_id));
        RETURN NEW;
    END IF;
    IF v_type = 'course_announcement' THEN
        v_due := NEW.created_at;
        v_expiry := v_due + interval '24 hours';
    ELSIF v_type = 'club_announcement' THEN
        v_due := GREATEST(NEW.created_at, COALESCE(NEW.publish_at, NEW.created_at));
        v_expiry := LEAST(v_due + interval '24 hours', COALESCE(NEW.expires_at, v_due + interval '24 hours'));
        IF NOT NEW.is_active THEN v_due := 'infinity'::TIMESTAMPTZ; END IF;
    ELSIF v_type = 'camp' THEN
        IF NEW.club_id IS NULL THEN RETURN NEW; END IF;
        v_context := jsonb_build_object('clubId', NEW.club_id);
    END IF;
    IF TG_OP = 'INSERT' THEN
        INSERT INTO private.push_events(source_type, source_id, context, not_before, expires_at)
        VALUES (v_type, NEW.id, v_context, v_due, v_expiry);
    ELSIF v_type = 'club_announcement' THEN
        UPDATE private.push_events SET not_before = v_due, expires_at = v_expiry
        WHERE source_type = v_type AND source_id = NEW.id AND expanded_at IS NULL AND cancelled_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER capture_course_announcement_push AFTER INSERT OR UPDATE OR DELETE ON public.course_announcements FOR EACH ROW EXECUTE FUNCTION private.capture_push_event('course_announcement');
CREATE TRIGGER capture_club_announcement_push AFTER INSERT OR UPDATE OR DELETE ON public.club_announcements FOR EACH ROW EXECUTE FUNCTION private.capture_push_event('club_announcement');
CREATE TRIGGER capture_attendance_push AFTER INSERT OR UPDATE OR DELETE ON public.attendance FOR EACH ROW EXECUTE FUNCTION private.capture_push_event('attendance');
CREATE TRIGGER capture_course_push AFTER INSERT OR UPDATE OR DELETE ON public.courses FOR EACH ROW EXECUTE FUNCTION private.capture_push_event('course');
CREATE TRIGGER capture_camp_push AFTER INSERT OR UPDATE OR DELETE ON public.camps FOR EACH ROW EXECUTE FUNCTION private.capture_push_event('camp');

CREATE FUNCTION private.push_device_current(p_device public.push_devices) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_device.revoked_at IS NULL AND p_device.updated_at > now() - interval '30 days'
      AND EXISTS (SELECT FROM public.push_preferences pr JOIN public.profiles p ON p.id = pr.user_id
        JOIN auth.sessions s ON s.user_id = p.id AND s.id = p_device.session_id
        WHERE p.id = p_device.user_id AND p.enabled AND p.role = 'PARENT' AND pr.enabled
          AND (s.not_after IS NULL OR s.not_after > now()));
$$;
CREATE FUNCTION public.claim_push_deliveries(p_limit INTEGER DEFAULT 20) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_event private.push_events; v_delivery private.push_deliveries; v_device public.push_devices; v_rows JSONB := '[]'::JSONB; v_lease UUID;
BEGIN
    IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid batch size' USING ERRCODE = '22023'; END IF;
    FOR v_event IN SELECT * FROM private.push_events WHERE expanded_at IS NULL AND cancelled_at IS NULL
        AND not_before <= now() ORDER BY not_before, id LIMIT 50 FOR UPDATE SKIP LOCKED LOOP
        IF v_event.expires_at > now() THEN
            INSERT INTO private.push_deliveries(event_id, user_id, binding_id)
            SELECT v_event.id, d.user_id, d.id FROM public.push_devices d
            WHERE d.created_at <= GREATEST(v_event.created_at, v_event.not_before)
              AND private.push_device_current(d) AND private.push_message(v_event, d.user_id) IS NOT NULL
            ON CONFLICT DO NOTHING;
        END IF;
        UPDATE private.push_events SET expanded_at = now() WHERE id = v_event.id;
    END LOOP;
    UPDATE private.push_deliveries SET state = 'dead', outcome_code = 'ATTEMPTS_EXHAUSTED', lease_id = NULL, lease_until = NULL, updated_at = now()
    WHERE state = 'sending' AND lease_until <= now() AND attempts >= 5;
    FOR v_delivery IN SELECT * FROM private.push_deliveries
        WHERE (state = 'pending' AND available_at <= now()) OR (state = 'sending' AND lease_until <= now() AND attempts < 5)
        ORDER BY available_at, id LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
        SELECT * INTO v_event FROM private.push_events WHERE id = v_delivery.event_id;
        SELECT * INTO v_device FROM public.push_devices WHERE id = v_delivery.binding_id;
        IF private.push_device_current(v_device) IS DISTINCT FROM TRUE OR private.push_message(v_event, v_delivery.user_id) IS NULL THEN
            UPDATE private.push_deliveries SET state = 'skipped', outcome_code = 'NO_LONGER_ELIGIBLE', lease_id = NULL, lease_until = NULL, updated_at = now() WHERE id = v_delivery.id;
            CONTINUE;
        END IF;
        v_lease := gen_random_uuid();
        UPDATE private.push_deliveries SET state = 'sending', attempts = attempts + 1,
            lease_id = v_lease, lease_until = now() + interval '2 minutes', updated_at = now() WHERE id = v_delivery.id;
        v_rows := v_rows || jsonb_build_array(jsonb_build_object('deliveryId', v_delivery.id, 'leaseId', v_lease));
    END LOOP;
    RETURN v_rows;
END;
$$;
CREATE FUNCTION public.prepare_push_delivery(p_delivery_id UUID, p_lease_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_delivery private.push_deliveries; v_event private.push_events; v_device public.push_devices; v_data JSONB;
BEGIN
    SELECT * INTO v_delivery FROM private.push_deliveries WHERE id = p_delivery_id AND state = 'sending'
      AND lease_id = p_lease_id AND lease_until > now() FOR UPDATE;
    IF NOT FOUND THEN RETURN NULL; END IF;
    SELECT * INTO v_event FROM private.push_events WHERE id = v_delivery.event_id;
    SELECT * INTO v_device FROM public.push_devices WHERE id = v_delivery.binding_id;
    v_data := private.push_message(v_event, v_delivery.user_id);
    IF private.push_device_current(v_device) IS DISTINCT FROM TRUE OR v_data IS NULL THEN
        UPDATE private.push_deliveries SET state = 'skipped', outcome_code = 'NO_LONGER_ELIGIBLE', lease_id = NULL, lease_until = NULL, updated_at = now() WHERE id = p_delivery_id;
        RETURN NULL;
    END IF;
    UPDATE private.push_deliveries SET token_hash = md5(v_device.token) WHERE id = p_delivery_id;
    RETURN jsonb_build_object('token', v_device.token, 'data', v_data || jsonb_build_object('bindingId', v_device.id::TEXT),
        'ttlSeconds', LEAST(3600, floor(extract(epoch FROM v_event.expires_at - now()))::INTEGER));
END;
$$;
CREATE FUNCTION public.finish_push_delivery(p_delivery_id UUID, p_lease_id UUID, p_outcome TEXT, p_code TEXT DEFAULT NULL, p_retry_after INTEGER DEFAULT 0) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_delivery private.push_deliveries;
BEGIN
    IF p_outcome NOT IN ('sent', 'retry', 'invalid_token', 'failed') OR p_outcome IS NULL
      OR (p_code IS NOT NULL AND (length(p_code) > 48 OR p_code !~ '^[A-Z0-9_]+$'))
      OR p_retry_after IS NULL OR p_retry_after NOT BETWEEN 0 AND 3600 THEN RAISE EXCEPTION 'Invalid delivery outcome' USING ERRCODE = '22023'; END IF;
    SELECT * INTO v_delivery FROM private.push_deliveries WHERE id = p_delivery_id AND state = 'sending' AND lease_id = p_lease_id AND lease_until > now() FOR UPDATE;
    IF NOT FOUND THEN RETURN; END IF;
    IF p_outcome = 'invalid_token' THEN
        UPDATE public.push_devices SET revoked_at = now(), updated_at = now()
        WHERE id = v_delivery.binding_id AND md5(token) = v_delivery.token_hash AND revoked_at IS NULL;
    END IF;
    UPDATE private.push_deliveries SET state = CASE WHEN p_outcome = 'sent' THEN 'sent'
        WHEN p_outcome = 'retry' AND attempts < 5 THEN 'pending' ELSE 'dead' END,
        available_at = now() + make_interval(secs => GREATEST(p_retry_after, LEAST(1800, 60 * (2 ^ (attempts - 1))::INTEGER))),
        outcome_code = p_code, lease_id = NULL, lease_until = NULL, updated_at = now()
    WHERE id = p_delivery_id;
END;
$$;

CREATE FUNCTION private.invoke_push_dispatch() RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_secret TEXT;
BEGIN
    DELETE FROM private.push_events WHERE id IN (SELECT id FROM private.push_events WHERE expires_at < now() - interval '30 days' OR cancelled_at < now() - interval '30 days' ORDER BY expires_at LIMIT 500);
    DELETE FROM public.push_devices WHERE id IN (SELECT id FROM public.push_devices WHERE updated_at < now() - interval '30 days' ORDER BY updated_at LIMIT 500);
    DELETE FROM private.push_binding_revocations WHERE id IN (SELECT id FROM private.push_binding_revocations WHERE created_at < now() - interval '30 days' ORDER BY created_at LIMIT 500);
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'push_dispatch_secret' LIMIT 1;
    IF v_secret IS NULL OR length(v_secret) < 32 THEN RETURN; END IF;
    PERFORM net.http_post(url := 'https://ehdzafadshbaaghzdzdo.supabase.co/functions/v1/dispatch-push',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-dispatch-secret', v_secret),
        body := '{}'::JSONB, timeout_milliseconds := 60000);
END;
$$;
SELECT cron.schedule('dispatch-parent-push', '* * * * *', 'SELECT private.invoke_push_dispatch();');

REVOKE ALL ON FUNCTION private.require_push_parent(), private.push_message(private.push_events, UUID),
    private.capture_push_event(), private.push_device_current(public.push_devices), private.invoke_push_dispatch()
    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_my_push_preferences(), public.set_my_push_enabled(BOOLEAN),
    public.register_push_device(UUID, UUID, TEXT), public.revoke_push_device(UUID),
    public.claim_push_deliveries(INTEGER), public.prepare_push_delivery(UUID, UUID),
    public.finish_push_delivery(UUID, UUID, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_push_preferences(), public.set_my_push_enabled(BOOLEAN),
    public.register_push_device(UUID, UUID, TEXT), public.revoke_push_device(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_deliveries(INTEGER), public.prepare_push_delivery(UUID, UUID),
    public.finish_push_delivery(UUID, UUID, TEXT, TEXT, INTEGER) TO service_role;
NOTIFY pgrst, 'reload schema';
