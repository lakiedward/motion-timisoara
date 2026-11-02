ALTER TABLE public.push_devices DROP CONSTRAINT push_devices_platform_check;
ALTER TABLE public.push_devices ADD CONSTRAINT push_devices_platform_check CHECK (platform IN ('android', 'web'));

CREATE FUNCTION private.web_push_subscription_valid(p_token TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE v_value JSONB; v_host TEXT;
BEGIN
    IF p_token IS NULL OR length(p_token) > 4096 THEN RETURN false; END IF;
    BEGIN
        v_value := p_token::JSONB;
    EXCEPTION WHEN others THEN
        RETURN false;
    END;
    IF jsonb_typeof(v_value) IS DISTINCT FROM 'object' OR jsonb_typeof(v_value->'keys') IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_value->'endpoint') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
    IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(v_value) k) IS DISTINCT FROM ARRAY['endpoint', 'keys']
       OR (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(v_value->'keys') k) IS DISTINCT FROM ARRAY['auth', 'p256dh'] THEN RETURN false; END IF;
    IF COALESCE(v_value->'keys'->>'p256dh', '') !~ '^[A-Za-z0-9_-]{87}$'
       OR COALESCE(v_value->'keys'->>'auth', '') !~ '^[A-Za-z0-9_-]{22}$'
       OR length(v_value->>'endpoint') > 2048 THEN RETURN false; END IF;
    v_host := substring(v_value->>'endpoint' FROM '^https://([a-z0-9.-]+)/[A-Za-z0-9._~:/?#@!$&''()*+,;=%-]*$');
    RETURN v_host IS NOT NULL AND (v_host = 'fcm.googleapis.com'
        OR v_host = 'updates.push.services.mozilla.com'
        OR v_host ~ '^([a-z0-9-]+\.)*push\.apple\.com$'
        OR v_host ~ '^[a-z0-9-]+\.notify\.windows\.com$');
END;
$$;

DROP FUNCTION public.register_push_device(UUID, UUID, TEXT);
CREATE FUNCTION public.register_push_device(p_installation_id UUID, p_binding_id UUID, p_token TEXT, p_platform TEXT DEFAULT 'android') RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := private.require_push_parent(); v_existing public.push_devices; v_lock TEXT;
BEGIN
    IF p_installation_id IS NULL OR p_binding_id IS NULL OR p_token IS NULL OR p_platform IS NULL
       OR p_platform NOT IN ('android', 'web')
       OR length(p_token) NOT BETWEEN 20 AND 4096 OR p_token ~ '[[:space:]]'
       OR (p_platform = 'web' AND NOT private.web_push_subscription_valid(p_token)) THEN
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
           OR v_existing.platform <> p_platform
           OR v_existing.session_id <> (auth.jwt()->>'session_id')::UUID OR v_existing.revoked_at IS NOT NULL)) THEN
        RAISE EXCEPTION 'New device binding required' USING ERRCODE = '42501';
    END IF;
    UPDATE public.push_devices SET revoked_at = now(), updated_at = now()
    WHERE id <> p_binding_id AND revoked_at IS NULL AND (installation_id = p_installation_id OR token = p_token);
    INSERT INTO public.push_devices(id, installation_id, user_id, session_id, token, platform)
    VALUES (p_binding_id, p_installation_id, v_user, (auth.jwt()->>'session_id')::UUID, p_token, p_platform)
    ON CONFLICT (id) DO UPDATE SET token = EXCLUDED.token, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_push_delivery(p_delivery_id UUID, p_lease_id UUID) RETURNS JSONB
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
    RETURN jsonb_build_object('token', v_device.token, 'platform', v_device.platform,
        'data', v_data || jsonb_build_object('bindingId', v_device.id::TEXT),
        'ttlSeconds', LEAST(3600, floor(extract(epoch FROM v_event.expires_at - now()))::INTEGER));
END;
$$;

REVOKE ALL ON FUNCTION private.web_push_subscription_valid(TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.register_push_device(UUID, UUID, TEXT, TEXT), public.prepare_push_delivery(UUID, UUID)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_push_device(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_push_delivery(UUID, UUID) TO service_role;
NOTIFY pgrst, 'reload schema';
