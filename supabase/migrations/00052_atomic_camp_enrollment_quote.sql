CREATE FUNCTION public.enrollment_camp_offer(p_camp_id UUID, p_child_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'amount', CASE WHEN c.pricing_mode = 'single' THEN c.price ELSE age_price.amount END,
        'currency', c.currency,
        'eur_ron_rate_micros', c.eur_ron_rate_micros
    )
    FROM public.camps c
    JOIN public.children ch ON ch.id = p_child_id
    LEFT JOIN LATERAL (
        SELECT p.amount FROM public.camp_age_prices p
        WHERE p.camp_id = c.id
            AND public.varsta_la_data(ch.birth_date, c.period_start) BETWEEN p.age_from AND p.age_to
        ORDER BY p.display_order, p.id
        LIMIT 1
    ) age_price ON true
    WHERE c.id = p_camp_id
$$;
REVOKE ALL ON FUNCTION public.enrollment_camp_offer(UUID, UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enrollment_camp_offer(UUID, UUID) TO service_role;
