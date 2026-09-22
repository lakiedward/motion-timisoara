-- To-Do #159 stage 2. A template is a snapshot owned by the same club or
-- coach account that owns camps. It stores the repeating offer only.
-- Title, slug, period, rules file, photos, coaches and the BNR rate stay
-- on the camp edition. Saving the same name again replaces that snapshot.

CREATE OR REPLACE FUNCTION public.necesar_sablon_tabara_valid(p_requirements JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT jsonb_typeof(p_requirements) = 'array'
       AND NOT EXISTS (
            SELECT
            FROM jsonb_array_elements(p_requirements) AS category(value)
            WHERE jsonb_typeof(category.value) <> 'object'
               OR jsonb_typeof(category.value -> 'name') <> 'string'
               OR btrim(category.value ->> 'name') = ''
               OR jsonb_typeof(category.value -> 'items') <> 'array'
               OR jsonb_array_length(category.value -> 'items') = 0
               OR EXISTS (
                    SELECT
                    FROM jsonb_array_elements(category.value -> 'items') AS item(value)
                    WHERE jsonb_typeof(item.value) <> 'object'
                       OR jsonb_typeof(item.value -> 'name') <> 'string'
                       OR btrim(item.value ->> 'name') = ''
                       OR jsonb_typeof(item.value -> 'quantity') <> 'number'
                       OR (item.value ->> 'quantity') !~ '^[1-9][0-9]*$'
                )
        );
$$;

CREATE OR REPLACE FUNCTION public.preturi_sablon_tabara_valide(p_prices JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
    IF jsonb_typeof(p_prices) IS DISTINCT FROM 'array' OR jsonb_array_length(p_prices) < 1 THEN
        RETURN FALSE;
    END IF;
    IF EXISTS (
        SELECT
        FROM jsonb_array_elements(p_prices) AS category(value)
        WHERE jsonb_typeof(category.value) <> 'object'
           OR jsonb_typeof(category.value -> 'age_from') <> 'number'
           OR jsonb_typeof(category.value -> 'age_to') <> 'number'
           OR CASE
                WHEN jsonb_typeof(category.value -> 'age_from') = 'number'
                 AND jsonb_typeof(category.value -> 'age_to') = 'number'
                THEN trunc((category.value ->> 'age_from')::NUMERIC) <> (category.value ->> 'age_from')::NUMERIC
                  OR trunc((category.value ->> 'age_to')::NUMERIC) <> (category.value ->> 'age_to')::NUMERIC
                  OR (category.value ->> 'age_from')::INT NOT BETWEEN 0 AND 25
                  OR (category.value ->> 'age_to')::INT NOT BETWEEN 0 AND 25
                  OR (category.value ->> 'age_from')::INT > (category.value ->> 'age_to')::INT
                ELSE FALSE
              END
           OR NOT public.componentele_categoriei_valide(category.value -> 'components')
    ) THEN
        RETURN FALSE;
    END IF;
    RETURN NOT EXISTS (
        SELECT
        FROM jsonb_array_elements(p_prices) WITH ORDINALITY AS left_category(value, position)
        JOIN jsonb_array_elements(p_prices) WITH ORDINALITY AS right_category(value, position)
          ON left_category.position < right_category.position
         AND (right_category.value ->> 'age_from')::INT <= (left_category.value ->> 'age_to')::INT
         AND (left_category.value ->> 'age_from')::INT <= (right_category.value ->> 'age_to')::INT
    );
END;
$$;

REVOKE ALL ON FUNCTION public.necesar_sablon_tabara_valid(JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.preturi_sablon_tabara_valide(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.necesar_sablon_tabara_valid(JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preturi_sablon_tabara_valide(JSONB) TO authenticated, service_role;

CREATE TABLE public.camp_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    rules TEXT,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    location_text TEXT,
    capacity INTEGER,
    allow_cash BOOLEAN NOT NULL DEFAULT FALSE,
    currency TEXT NOT NULL,
    camp_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
    age_prices JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT camp_templates_owner_ck CHECK (num_nonnulls(club_id, coach_id) = 1),
    CONSTRAINT camp_templates_name_ck CHECK (
        char_length(name) BETWEEN 1 AND 120 AND name = btrim(name)
    ),
    CONSTRAINT camp_templates_currency_ck CHECK (currency IN ('RON', 'EUR')),
    CONSTRAINT camp_templates_rules_ck CHECK (rules IS NULL OR char_length(rules) <= 8000),
    CONSTRAINT camp_templates_capacity_ck CHECK (capacity IS NULL OR capacity >= 0),
    CONSTRAINT camp_templates_requirements_ck CHECK (
        public.necesar_sablon_tabara_valid(camp_requirements)
    ),
    CONSTRAINT camp_templates_age_prices_ck CHECK (
        public.preturi_sablon_tabara_valide(age_prices)
    )
);

CREATE UNIQUE INDEX camp_templates_club_name_uidx
    ON public.camp_templates (club_id, name)
    WHERE club_id IS NOT NULL;

CREATE UNIQUE INDEX camp_templates_coach_name_uidx
    ON public.camp_templates (coach_id, name)
    WHERE coach_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.camp_templates_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER camp_templates_touch_updated_at
    BEFORE UPDATE ON public.camp_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.camp_templates_touch_updated_at();

ALTER TABLE public.camp_templates ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.camp_templates FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.camp_templates TO authenticated;

CREATE POLICY camp_templates_select ON public.camp_templates
    FOR SELECT TO authenticated
    USING (
        (
            public.get_my_role() = 'CLUB'
            AND coach_id IS NULL
            AND club_id IN (SELECT public.my_club_ids())
        )
        OR (
            public.get_my_role() IN ('COACH', 'ADMIN')
            AND club_id IS NULL
            AND coach_id = (SELECT auth.uid())
        )
    );

CREATE POLICY camp_templates_insert ON public.camp_templates
    FOR INSERT TO authenticated
    WITH CHECK (
        (
            public.get_my_role() = 'CLUB'
            AND coach_id IS NULL
            AND club_id IN (SELECT public.my_club_ids())
        )
        OR (
            public.get_my_role() IN ('COACH', 'ADMIN')
            AND club_id IS NULL
            AND coach_id = (SELECT auth.uid())
        )
    );

CREATE POLICY camp_templates_update ON public.camp_templates
    FOR UPDATE TO authenticated
    USING (
        (
            public.get_my_role() = 'CLUB'
            AND coach_id IS NULL
            AND club_id IN (SELECT public.my_club_ids())
        )
        OR (
            public.get_my_role() IN ('COACH', 'ADMIN')
            AND club_id IS NULL
            AND coach_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        (
            public.get_my_role() = 'CLUB'
            AND coach_id IS NULL
            AND club_id IN (SELECT public.my_club_ids())
        )
        OR (
            public.get_my_role() IN ('COACH', 'ADMIN')
            AND club_id IS NULL
            AND coach_id = (SELECT auth.uid())
        )
    );

CREATE POLICY camp_templates_delete ON public.camp_templates
    FOR DELETE TO authenticated
    USING (
        (
            public.get_my_role() = 'CLUB'
            AND coach_id IS NULL
            AND club_id IN (SELECT public.my_club_ids())
        )
        OR (
            public.get_my_role() IN ('COACH', 'ADMIN')
            AND club_id IS NULL
            AND coach_id = (SELECT auth.uid())
        )
    );

CREATE OR REPLACE FUNCTION public.save_camp_template(
    p_name TEXT,
    p_club_id UUID,
    p_coach_id UUID,
    p_description TEXT,
    p_rules TEXT,
    p_location_id UUID,
    p_location_text TEXT,
    p_capacity INTEGER,
    p_allow_cash BOOLEAN,
    p_currency TEXT,
    p_camp_requirements JSONB,
    p_age_prices JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_name TEXT := btrim(coalesce(p_name, ''));
    v_rules TEXT := NULLIF(btrim(coalesce(p_rules, '')), '');
    v_description TEXT := NULLIF(btrim(coalesce(p_description, '')), '');
    v_location_text TEXT := NULLIF(btrim(coalesce(p_location_text, '')), '');
    v_requirements JSONB := coalesce(p_camp_requirements, '[]'::jsonb);
    v_id UUID;
BEGIN
    IF public.get_my_role() = 'CLUB' THEN
        IF p_club_id IS NULL OR p_coach_id IS NOT NULL
           OR NOT EXISTS (SELECT 1 FROM public.my_club_ids() AS club_id WHERE club_id = p_club_id) THEN
            RAISE EXCEPTION 'Nu poti salva un sablon pentru alt organizator' USING ERRCODE = '42501';
        END IF;
    ELSIF public.get_my_role() IN ('COACH', 'ADMIN') THEN
        IF p_coach_id IS DISTINCT FROM (SELECT auth.uid()) OR p_club_id IS NOT NULL THEN
            RAISE EXCEPTION 'Nu poti salva un sablon pentru alt organizator' USING ERRCODE = '42501';
        END IF;
    ELSE
        RAISE EXCEPTION 'Nu poti salva un sablon pentru alt organizator' USING ERRCODE = '42501';
    END IF;

    IF char_length(v_name) < 1 OR char_length(v_name) > 120 THEN
        RAISE EXCEPTION 'Numele sablonului lipseste' USING ERRCODE = 'P0001';
    END IF;
    IF v_rules IS NOT NULL AND char_length(v_rules) > 8000 THEN
        RAISE EXCEPTION 'Regulamentul este prea lung' USING ERRCODE = 'P0001';
    END IF;
    IF p_currency NOT IN ('RON', 'EUR') THEN
        RAISE EXCEPTION 'Moneda sablonului nu este valida' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.necesar_sablon_tabara_valid(v_requirements) THEN
        RAISE EXCEPTION 'Necesarul nu este valid' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.preturi_sablon_tabara_valide(p_age_prices) THEN
        RAISE EXCEPTION 'Categoriile de varsta nu sunt valide' USING ERRCODE = 'P0001';
    END IF;

    IF p_club_id IS NOT NULL THEN
        INSERT INTO public.camp_templates (
            club_id, coach_id, name, description, rules, location_id, location_text,
            capacity, allow_cash, currency, camp_requirements, age_prices
        ) VALUES (
            p_club_id, NULL, v_name, v_description, v_rules, p_location_id, v_location_text,
            p_capacity, coalesce(p_allow_cash, false), p_currency, v_requirements, p_age_prices
        )
        ON CONFLICT (club_id, name) WHERE club_id IS NOT NULL
        DO UPDATE SET
            description = EXCLUDED.description,
            rules = EXCLUDED.rules,
            location_id = EXCLUDED.location_id,
            location_text = EXCLUDED.location_text,
            capacity = EXCLUDED.capacity,
            allow_cash = EXCLUDED.allow_cash,
            currency = EXCLUDED.currency,
            camp_requirements = EXCLUDED.camp_requirements,
            age_prices = EXCLUDED.age_prices
        RETURNING id INTO v_id;
    ELSE
        INSERT INTO public.camp_templates (
            club_id, coach_id, name, description, rules, location_id, location_text,
            capacity, allow_cash, currency, camp_requirements, age_prices
        ) VALUES (
            NULL, p_coach_id, v_name, v_description, v_rules, p_location_id, v_location_text,
            p_capacity, coalesce(p_allow_cash, false), p_currency, v_requirements, p_age_prices
        )
        ON CONFLICT (coach_id, name) WHERE coach_id IS NOT NULL
        DO UPDATE SET
            description = EXCLUDED.description,
            rules = EXCLUDED.rules,
            location_id = EXCLUDED.location_id,
            location_text = EXCLUDED.location_text,
            capacity = EXCLUDED.capacity,
            allow_cash = EXCLUDED.allow_cash,
            currency = EXCLUDED.currency,
            camp_requirements = EXCLUDED.camp_requirements,
            age_prices = EXCLUDED.age_prices
        RETURNING id INTO v_id;
    END IF;

    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_camp_template(
    TEXT, UUID, UUID, TEXT, TEXT, UUID, TEXT, INTEGER, BOOLEAN, TEXT, JSONB, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_camp_template(
    TEXT, UUID, UUID, TEXT, TEXT, UUID, TEXT, INTEGER, BOOLEAN, TEXT, JSONB, JSONB
) TO authenticated;
