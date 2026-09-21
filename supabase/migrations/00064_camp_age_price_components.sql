CREATE OR REPLACE FUNCTION public.componentele_categoriei_valide(p_components JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT jsonb_typeof(p_components) = 'array'
       AND jsonb_array_length(p_components) >= 1
       AND NOT EXISTS (
           SELECT 1
           FROM jsonb_array_elements(p_components) AS c
           WHERE jsonb_typeof(c) IS DISTINCT FROM 'object'
              OR coalesce(btrim(c->>'name'), '') = ''
              OR jsonb_typeof(c->'amount') IS DISTINCT FROM 'number'
              OR (c->>'amount')::NUMERIC NOT BETWEEN 0 AND 9007199254740991
              OR trunc((c->>'amount')::NUMERIC) <> (c->>'amount')::NUMERIC
       );
$$;

CREATE OR REPLACE FUNCTION public.suma_componentelor_categoriei(p_components JSONB)
RETURNS BIGINT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT coalesce(sum(
        CASE
            WHEN jsonb_typeof(c->'amount') = 'number'
                 AND (c->>'amount')::NUMERIC BETWEEN 0 AND 9007199254740991
                 AND trunc((c->>'amount')::NUMERIC) = (c->>'amount')::NUMERIC
            THEN (c->>'amount')::BIGINT
            ELSE 0
        END
    ), 0)
    FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(p_components) = 'array' THEN p_components ELSE '[]'::jsonb END
    ) AS c;
$$;

REVOKE ALL ON FUNCTION public.componentele_categoriei_valide(JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.suma_componentelor_categoriei(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.componentele_categoriei_valide(JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.suma_componentelor_categoriei(JSONB) TO authenticated, service_role;

ALTER TABLE public.camp_age_prices
    ADD COLUMN IF NOT EXISTS components JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.camp_age_prices
SET components = jsonb_build_array(
    jsonb_build_object('name', 'Participare', 'amount', amount)
)
WHERE jsonb_typeof(components) IS DISTINCT FROM 'array'
   OR jsonb_array_length(components) = 0;

ALTER TABLE public.camp_age_prices
    DROP CONSTRAINT IF EXISTS camp_age_prices_components_ck;

ALTER TABLE public.camp_age_prices
    ADD CONSTRAINT camp_age_prices_components_ck CHECK (
        public.componentele_categoriei_valide(components)
        AND amount = public.suma_componentelor_categoriei(components)
    );

CREATE OR REPLACE FUNCTION public.salveaza_preturile_pe_varsta(
    p_camp_id UUID,
    p_pricing_mode TEXT,
    p_categorii JSONB
)
RETURNS SETOF public.camp_age_prices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    gresite INT;
    suprapuse RECORD;
    categorie JSONB;
    ordine INT;
    v_amount BIGINT;
    v_components JSONB;
BEGIN
    IF NOT public.pot_administra_tabara(p_camp_id) THEN
        RAISE EXCEPTION 'Nu ai voie sa schimbi preturile acestei tabere'
            USING ERRCODE = '42501';
    END IF;

    IF p_pricing_mode NOT IN ('single', 'by_age') THEN
        RAISE EXCEPTION 'Mod de pret necunoscut: %', p_pricing_mode USING ERRCODE = 'P0001';
    END IF;

    IF p_pricing_mode = 'by_age' AND jsonb_array_length(coalesce(p_categorii, '[]'::jsonb)) = 0 THEN
        RAISE EXCEPTION 'Pretul pe categorii are nevoie de cel putin o categorie de varsta'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT count(*) INTO gresite
    FROM jsonb_array_elements(coalesce(p_categorii, '[]'::jsonb)) c
    WHERE (c->>'age_from')::INT IS NULL
       OR (c->>'age_to')::INT IS NULL
       OR (c->>'age_from')::INT > (c->>'age_to')::INT
       OR (c->>'age_from')::INT NOT BETWEEN 0 AND 25
       OR (c->>'age_to')::INT NOT BETWEEN 0 AND 25
       OR coalesce((c->>'amount')::BIGINT, -1) < 0;

    IF gresite > 0 THEN
        RAISE EXCEPTION 'Fiecare categorie are nevoie de un interval de varsta valid (0-25 ani) si de o suma'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT a.f AS a_from, a.t AS a_to, b.f AS b_from, b.t AS b_to INTO suprapuse
    FROM (SELECT (c->>'age_from')::INT f, (c->>'age_to')::INT t, o FROM jsonb_array_elements(coalesce(p_categorii, '[]'::jsonb)) WITH ORDINALITY AS x(c, o)) a
    JOIN (SELECT (c->>'age_from')::INT f, (c->>'age_to')::INT t, o FROM jsonb_array_elements(coalesce(p_categorii, '[]'::jsonb)) WITH ORDINALITY AS y(c, o)) b
      ON a.o < b.o AND b.f <= a.t AND a.f <= b.t
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION
            'Categoria %–% ani se suprapune cu %–% ani', suprapuse.a_from, suprapuse.a_to, suprapuse.b_from, suprapuse.b_to
            USING ERRCODE = 'P0001';
    END IF;

    FOR categorie IN
        SELECT c FROM jsonb_array_elements(coalesce(p_categorii, '[]'::jsonb)) AS t(c)
    LOOP
        IF jsonb_typeof(categorie->'components') = 'array'
           AND jsonb_array_length(categorie->'components') > 0 THEN
            SELECT jsonb_agg(jsonb_build_object(
                       'name', btrim(item->>'name'),
                       'amount', (item->>'amount')::BIGINT
                   ) ORDER BY ord)
            INTO v_components
            FROM jsonb_array_elements(categorie->'components') WITH ORDINALITY AS t(item, ord);

            IF NOT public.componentele_categoriei_valide(v_components) THEN
                RAISE EXCEPTION 'Fiecare componenta are nevoie de un nume si o suma valida'
                    USING ERRCODE = 'P0001';
            END IF;
            IF public.suma_componentelor_categoriei(v_components) IS DISTINCT FROM (categorie->>'amount')::BIGINT THEN
                RAISE EXCEPTION 'Suma componentelor (%) nu da pretul categoriei (%)',
                    public.suma_componentelor_categoriei(v_components), (categorie->>'amount')::BIGINT
                    USING ERRCODE = 'P0001';
            END IF;
        END IF;
    END LOOP;

    DELETE FROM public.camp_age_prices WHERE camp_id = p_camp_id;

    FOR categorie, ordine IN
        SELECT c, ordinalitate
        FROM jsonb_array_elements(coalesce(p_categorii, '[]'::jsonb)) WITH ORDINALITY AS t(c, ordinalitate)
    LOOP
        v_amount := (categorie->>'amount')::BIGINT;
        IF jsonb_typeof(categorie->'components') = 'array'
           AND jsonb_array_length(categorie->'components') > 0 THEN
            SELECT jsonb_agg(jsonb_build_object(
                       'name', btrim(item->>'name'),
                       'amount', (item->>'amount')::BIGINT
                   ) ORDER BY ord)
            INTO v_components
            FROM jsonb_array_elements(categorie->'components') WITH ORDINALITY AS t(item, ord);

            IF NOT public.componentele_categoriei_valide(v_components) THEN
                RAISE EXCEPTION 'Fiecare componenta are nevoie de un nume si o suma valida'
                    USING ERRCODE = 'P0001';
            END IF;
            IF public.suma_componentelor_categoriei(v_components) IS DISTINCT FROM v_amount THEN
                RAISE EXCEPTION 'Suma componentelor (%) nu da pretul categoriei (%)',
                    public.suma_componentelor_categoriei(v_components), v_amount
                    USING ERRCODE = 'P0001';
            END IF;
        ELSE
            v_components := jsonb_build_array(
                jsonb_build_object('name', 'Participare', 'amount', v_amount)
            );
        END IF;

        INSERT INTO public.camp_age_prices (
            camp_id, age_from, age_to, amount, display_order, components
        ) VALUES (
            p_camp_id,
            (categorie->>'age_from')::INT,
            (categorie->>'age_to')::INT,
            v_amount,
            (ordine - 1)::INT,
            v_components
        );
    END LOOP;

    UPDATE public.camps SET pricing_mode = p_pricing_mode WHERE id = p_camp_id;

    RETURN QUERY
    SELECT * FROM public.camp_age_prices WHERE camp_id = p_camp_id ORDER BY display_order;
END;
$$;

COMMENT ON COLUMN public.camp_age_prices.components IS
    'Named cost components in minor units. Their amounts sum to camp_age_prices.amount.';
COMMENT ON FUNCTION public.salveaza_preturile_pe_varsta(UUID, TEXT, JSONB) IS
    'Writes pricing_mode, age categories and named components together. Missing components become Participare.';
