ALTER TABLE public.location_reverse_provider DROP CONSTRAINT location_reverse_provider_provider_check;
UPDATE public.location_reverse_provider SET provider = 'fallback';
ALTER TABLE public.location_reverse_provider ADD CONSTRAINT location_reverse_provider_provider_check CHECK (provider = 'fallback');
CREATE OR REPLACE FUNCTION public.claim_location_reverse(p_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  cached jsonb;
  token uuid;
BEGIN
  IF p_key !~ '^-?[0-9]{1,3}\.[0-9]{5},-?[0-9]{1,3}\.[0-9]{5}$' THEN
    RAISE EXCEPTION 'Invalid coordinate key';
  END IF;
  SELECT result INTO cached FROM public.location_reverse_cache
    WHERE coordinate_key = p_key AND expires_at > clock_timestamp();
  IF FOUND THEN RETURN jsonb_build_object('cached', cached); END IF;

  UPDATE public.location_reverse_provider
    SET lease_token = gen_random_uuid(), available_at = clock_timestamp() + interval '10 seconds'
    WHERE provider = 'fallback' AND available_at <= clock_timestamp()
    RETURNING lease_token INTO token;
  RETURN jsonb_build_object('token', token);
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_location_reverse(p_token uuid, p_key text, p_result jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  UPDATE public.location_reverse_provider
    SET lease_token = NULL, available_at = clock_timestamp() + interval '1.1 seconds'
    WHERE provider = 'fallback' AND lease_token = p_token;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_result IS NOT NULL AND jsonb_typeof(p_result) = 'object' THEN
    INSERT INTO public.location_reverse_cache (coordinate_key, result)
      VALUES (p_key, p_result)
      ON CONFLICT (coordinate_key) DO UPDATE
      SET result = EXCLUDED.result, expires_at = clock_timestamp() + interval '7 days';
  END IF;
  DELETE FROM public.location_reverse_cache WHERE expires_at < clock_timestamp();
END;
$$;

REVOKE ALL ON FUNCTION public.claim_location_reverse(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_location_reverse(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_location_reverse(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_location_reverse(uuid, text, jsonb) TO service_role;
