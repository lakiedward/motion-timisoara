CREATE TABLE public.location_reverse_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinate_key text NOT NULL UNIQUE,
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX location_reverse_cache_expiry ON public.location_reverse_cache (expires_at);
ALTER TABLE public.location_reverse_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.location_reverse_cache FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.location_reverse_cache TO service_role;

CREATE TABLE public.location_reverse_provider (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE CHECK (provider = 'nominatim'),
  lease_token uuid,
  available_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.location_reverse_provider ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.location_reverse_provider FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.location_reverse_provider TO service_role;
INSERT INTO public.location_reverse_provider (provider) VALUES ('nominatim');

CREATE FUNCTION public.claim_location_reverse(p_key text)
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
    WHERE provider = 'nominatim' AND available_at <= clock_timestamp()
    RETURNING lease_token INTO token;
  RETURN jsonb_build_object('token', token);
END;
$$;

CREATE FUNCTION public.finish_location_reverse(p_token uuid, p_key text, p_result jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  UPDATE public.location_reverse_provider
    SET lease_token = NULL, available_at = clock_timestamp() + interval '1.1 seconds'
    WHERE provider = 'nominatim' AND lease_token = p_token;
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
