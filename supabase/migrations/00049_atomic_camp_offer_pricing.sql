CREATE OR REPLACE FUNCTION public.save_camp_offer_pricing(
    p_camp_id UUID,
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
BEGIN
    IF public.pot_administra_tabara(p_camp_id) IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Nu ai voie sa schimbi preturile acestei tabere'
            USING ERRCODE = '42501';
    END IF;

    PERFORM 1 FROM public.camps WHERE id = p_camp_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tabara nu a fost gasita' USING ERRCODE = 'P0002';
    END IF;

    IF p_price IS NULL OR p_price NOT BETWEEN 0 AND 9007199254740991
       OR p_currency IS NULL OR p_currency NOT IN ('RON', 'EUR')
       OR (p_currency = 'RON' AND p_eur_ron_rate_micros IS NOT NULL)
       OR (p_currency = 'EUR' AND (p_eur_ron_rate_micros IS NULL
           OR p_eur_ron_rate_micros NOT BETWEEN 1 AND 9007199254740991))
       OR p_pricing_mode IS NULL OR p_pricing_mode NOT IN ('single', 'by_age')
       OR jsonb_typeof(p_breakdown) IS DISTINCT FROM 'array'
       OR jsonb_typeof(p_age_prices) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Pretul, moneda sau cursul sunt invalide' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_breakdown || p_age_prices) item
        WHERE jsonb_typeof(item->'amount') IS DISTINCT FROM 'number'
            OR (item->>'amount')::NUMERIC NOT BETWEEN 0 AND 9007199254740991
            OR trunc((item->>'amount')::NUMERIC) <> (item->>'amount')::NUMERIC
    ) THEN
        RAISE EXCEPTION 'Sumele categoriilor sunt invalide' USING ERRCODE = '22023';
    END IF;

    UPDATE public.camps
    SET currency = p_currency, eur_ron_rate_micros = p_eur_ron_rate_micros
    WHERE id = p_camp_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Nu ai voie sa schimbi preturile acestei tabere'
            USING ERRCODE = '42501';
    END IF;

    PERFORM public.salveaza_banii_taberei(p_camp_id, p_price, p_breakdown);
    PERFORM public.salveaza_preturile_pe_varsta(p_camp_id, p_pricing_mode, p_age_prices);
END;
$$;

REVOKE ALL ON FUNCTION public.save_camp_offer_pricing(UUID, BIGINT, TEXT, BIGINT, JSONB, TEXT, JSONB)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_camp_offer_pricing(UUID, BIGINT, TEXT, BIGINT, JSONB, TEXT, JSONB)
    TO authenticated;
