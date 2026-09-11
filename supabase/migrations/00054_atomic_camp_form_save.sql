CREATE FUNCTION public.save_camp_offer(
    p_camp_id UUID,
    p_metadata JSONB,
    p_club_id UUID,
    p_coach_id UUID,
    p_price BIGINT,
    p_currency TEXT,
    p_eur_ron_rate_micros BIGINT,
    p_breakdown JSONB,
    p_pricing_mode TEXT,
    p_age_prices JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fields public.camps;
BEGIN
    IF p_camp_id IS NULL OR jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'Invalid camp data' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_fields FROM jsonb_populate_record(NULL::public.camps, p_metadata);
    IF NOT EXISTS (SELECT FROM public.camps WHERE id = p_camp_id) THEN
        INSERT INTO public.camps(id, club_id, coach_id, title, slug, description,
            period_start, period_end, location_id, location_text, capacity, allow_cash,
            price, currency, eur_ron_rate_micros)
        VALUES (p_camp_id, p_club_id, p_coach_id, v_fields.title, v_fields.slug, v_fields.description,
            v_fields.period_start, v_fields.period_end, v_fields.location_id, v_fields.location_text,
            v_fields.capacity, v_fields.allow_cash, p_price, p_currency, p_eur_ron_rate_micros)
        ON CONFLICT (id) DO NOTHING;
    END IF;
    IF public.pot_administra_tabara(p_camp_id) IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Camp is not owned by caller' USING ERRCODE = '42501';
    END IF;
    UPDATE public.camps SET title = v_fields.title, slug = v_fields.slug,
        description = v_fields.description, period_start = v_fields.period_start,
        period_end = v_fields.period_end, location_id = v_fields.location_id,
        location_text = v_fields.location_text, capacity = v_fields.capacity,
        allow_cash = v_fields.allow_cash
    WHERE id = p_camp_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Camp cannot be updated' USING ERRCODE = '42501';
    END IF;
    PERFORM public.save_camp_offer_pricing(p_camp_id, p_price, p_currency,
        p_eur_ron_rate_micros, p_breakdown, p_pricing_mode, p_age_prices);
END;
$$;
REVOKE ALL ON FUNCTION public.save_camp_offer(UUID, JSONB, UUID, UUID, BIGINT, TEXT, BIGINT, JSONB, TEXT, JSONB)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_camp_offer(UUID, JSONB, UUID, UUID, BIGINT, TEXT, BIGINT, JSONB, TEXT, JSONB)
    TO authenticated;
