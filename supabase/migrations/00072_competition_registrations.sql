ALTER TABLE public.enrollments DROP CONSTRAINT enrollments_kind_check;
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_kind_check
    CHECK (kind IN ('COURSE', 'CAMP', 'ACTIVITY', 'COMPETITION'));

ALTER TABLE public.enrollments DROP CONSTRAINT enrollments_participant_xor_ck;
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_participant_xor_ck CHECK (
    (child_id IS NOT NULL AND adult_profile_id IS NULL)
    OR (child_id IS NULL AND adult_profile_id IS NOT NULL AND kind IN ('CAMP', 'COMPETITION'))
);

CREATE UNIQUE INDEX enrollments_competition_child_active_uidx
    ON public.enrollments (entity_id, child_id)
    WHERE kind = 'COMPETITION' AND status IN ('PENDING', 'ACTIVE');

CREATE UNIQUE INDEX enrollments_competition_adult_active_uidx
    ON public.enrollments (entity_id, adult_profile_id)
    WHERE kind = 'COMPETITION' AND adult_profile_id IS NOT NULL
      AND status IN ('PENDING', 'ACTIVE');

CREATE TABLE public.competition_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL UNIQUE REFERENCES public.enrollments(id) ON DELETE CASCADE,
    competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE RESTRICT,
    category_id UUID NOT NULL,
    route_id UUID NOT NULL,
    category_name_snapshot TEXT NOT NULL,
    route_name_snapshot TEXT NOT NULL,
    gpx_storage_path_snapshot TEXT NOT NULL,
    adult_profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    adult_birth_date DATE,
    age_at_registration INTEGER NOT NULL,
    accepted_price_bani BIGINT NOT NULL,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT competition_registrations_category_fk FOREIGN KEY (category_id, competition_id)
        REFERENCES public.competition_age_categories (id, competition_id) ON DELETE RESTRICT,
    CONSTRAINT competition_registrations_route_fk FOREIGN KEY (competition_id, route_id)
        REFERENCES public.competition_routes (competition_id, id) ON DELETE RESTRICT,
    CONSTRAINT competition_registrations_podium_key UNIQUE (id, competition_id, category_id),
    CONSTRAINT competition_registrations_age_ck CHECK (age_at_registration BETWEEN 0 AND 120),
    CONSTRAINT competition_registrations_adult_birth_ck CHECK (
        (adult_profile_id IS NULL AND adult_birth_date IS NULL)
        OR (adult_profile_id IS NOT NULL AND adult_birth_date IS NOT NULL)
    ),
    CONSTRAINT competition_registrations_price_ck CHECK (accepted_price_bani BETWEEN 0 AND 99999999),
    CONSTRAINT competition_registrations_category_name_ck CHECK (char_length(btrim(category_name_snapshot)) BETWEEN 1 AND 120),
    CONSTRAINT competition_registrations_route_name_ck CHECK (char_length(btrim(route_name_snapshot)) BETWEEN 1 AND 120),
    CONSTRAINT competition_registrations_gpx_path_ck CHECK (
        gpx_storage_path_snapshot ~ (
            '^' || competition_id::TEXT || '/routes/' || route_id::TEXT ||
            '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.gpx$'
        )
    )
);

CREATE INDEX competition_registrations_competition_category_idx
    ON public.competition_registrations (competition_id, category_id, registered_at);
CREATE INDEX competition_registrations_route_idx
    ON public.competition_registrations (competition_id, route_id);
CREATE INDEX competition_registrations_adult_profile_idx
    ON public.competition_registrations (adult_profile_id)
    WHERE adult_profile_id IS NOT NULL;
CREATE INDEX competition_registrations_gpx_path_idx
    ON public.competition_registrations (gpx_storage_path_snapshot);

CREATE FUNCTION public.guard_competition_owner_with_registrations()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF (NEW.club_id IS DISTINCT FROM OLD.club_id
        OR NEW.coach_id IS DISTINCT FROM OLD.coach_id)
        AND EXISTS (
            SELECT 1 FROM public.competition_registrations registration
            WHERE registration.competition_id = OLD.id
        ) THEN
        RAISE EXCEPTION 'Organizatorul nu poate fi schimbat după prima înscriere'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER competitions_owner_registration_guard
    BEFORE UPDATE OF club_id, coach_id ON public.competitions
    FOR EACH ROW EXECUTE FUNCTION public.guard_competition_owner_with_registrations();

DROP POLICY competition_routes_storage_delete ON storage.objects;
CREATE POLICY competition_routes_storage_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'competition-routes'
        AND public.pot_administra_concurs(public.safe_uuid((storage.foldername(name))[1]))
        AND NOT EXISTS (
            SELECT 1 FROM public.competition_routes route
            WHERE route.gpx_storage_path = name
        )
        AND NOT EXISTS (
            SELECT 1 FROM public.competition_registrations registration
            WHERE registration.gpx_storage_path_snapshot = name
        )
    );

CREATE FUNCTION public.guard_competition_route_storage_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF OLD.bucket_id = 'competition-routes'
        AND (
            EXISTS (
                SELECT 1 FROM public.competition_routes route
                WHERE route.gpx_storage_path = OLD.name
            )
            OR EXISTS (
                SELECT 1 FROM public.competition_registrations registration
                WHERE registration.gpx_storage_path_snapshot = OLD.name
            )
        ) THEN
        RAISE EXCEPTION 'Un GPX folosit de un traseu sau de o înscriere nu poate fi șters'
            USING ERRCODE = '23503';
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER competition_routes_storage_delete_guard
    BEFORE DELETE ON storage.objects
    FOR EACH ROW EXECUTE FUNCTION public.guard_competition_route_storage_delete();

CREATE FUNCTION public.guard_competition_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    enrollment public.enrollments;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Accepted competition registration cannot be changed'
            USING ERRCODE = '23514';
    END IF;

    SELECT * INTO enrollment FROM public.enrollments WHERE id = NEW.enrollment_id;
    IF NOT FOUND OR enrollment.kind IS DISTINCT FROM 'COMPETITION'
        OR enrollment.entity_id IS DISTINCT FROM NEW.competition_id
        OR (enrollment.child_id IS NULL AND enrollment.adult_profile_id IS NULL)
        OR (enrollment.child_id IS NOT NULL AND NEW.adult_profile_id IS NOT NULL)
        OR (enrollment.adult_profile_id IS NOT NULL AND (
            enrollment.adult_profile_id IS DISTINCT FROM NEW.adult_profile_id
            OR NEW.adult_birth_date IS NULL
            OR NEW.age_at_registration IS DISTINCT FROM public.varsta_la_data(
                NEW.adult_birth_date, (NEW.registered_at AT TIME ZONE 'Europe/Bucharest')::DATE
            )
            OR NEW.age_at_registration < 18
        )) THEN
        RAISE EXCEPTION 'Competition registration does not match its enrollment'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER competition_registrations_guard
    BEFORE INSERT OR UPDATE ON public.competition_registrations
    FOR EACH ROW EXECUTE FUNCTION public.guard_competition_registration();

CREATE FUNCTION public.can_view_competition_registrations(p_competition_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.competitions c
        WHERE c.id = p_competition_id
          AND (
              public.pot_administra_concurs(c.id)
              OR EXISTS (
                  SELECT 1 FROM public.competition_coaches cc
                  JOIN public.coach_profiles cp ON cp.id = cc.coach_profile_id
                  WHERE cc.competition_id = c.id
                    AND cc.status = 'accepted'
                    AND cp.user_id = (SELECT auth.uid())
              )
          )
    )
$$;

REVOKE ALL ON FUNCTION public.can_view_competition_registrations(UUID)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_competition_registrations(UUID)
    TO authenticated;

ALTER TABLE public.competition_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.competition_registrations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.competition_registrations TO authenticated;

CREATE POLICY competition_registrations_select ON public.competition_registrations
    FOR SELECT TO authenticated
    USING (
        enrollment_id IN (
            SELECT e.id FROM public.enrollments e
            WHERE e.child_id IN (SELECT public.my_child_ids())
               OR e.adult_profile_id = (SELECT auth.uid())
        )
        OR public.can_view_competition_registrations(competition_id)
    );

CREATE POLICY enrollments_competition_staff_select ON public.enrollments
    FOR SELECT TO authenticated
    USING (
        kind = 'COMPETITION'
        AND public.can_view_competition_registrations(entity_id)
    );

CREATE POLICY payments_competition_staff_select ON public.payments
    FOR SELECT TO authenticated
    USING (
        enrollment_id IN (
            SELECT e.id FROM public.enrollments e
            WHERE e.kind = 'COMPETITION'
              AND public.pot_administra_concurs(e.entity_id)
        )
    );

CREATE FUNCTION public.competition_price_version(
    p_competition_id UUID,
    p_child_id UUID,
    p_category_id UUID,
    p_route_id UUID,
    p_gpx_storage_path TEXT,
    p_price_bani BIGINT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT pg_catalog.encode(
        pg_catalog.sha256(
            pg_catalog.convert_to(
                pg_catalog.replace(
                    pg_catalog.jsonb_build_array(
                        2, 'COMPETITION', p_competition_id, p_child_id,
                        p_category_id, p_route_id, p_gpx_storage_path, p_price_bani,
                        'RON', 1, NULL, p_price_bani, 'RON'
                    )::TEXT,
                    ', ', ','
                ),
                'UTF8'
            )
        ),
        'hex'
    )
$$;

REVOKE ALL ON FUNCTION public.competition_price_version(UUID, UUID, UUID, UUID, TEXT, BIGINT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.competition_price_version(UUID, UUID, UUID, UUID, TEXT, BIGINT)
    TO authenticated, service_role;

CREATE FUNCTION public.competition_price_version(
    p_competition_id UUID,
    p_adult_profile_id UUID,
    p_adult_birth_date DATE,
    p_category_id UUID,
    p_route_id UUID,
    p_gpx_storage_path TEXT,
    p_price_bani BIGINT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT pg_catalog.encode(
        pg_catalog.sha256(
            pg_catalog.convert_to(
                pg_catalog.replace(
                    pg_catalog.jsonb_build_array(
                        2, 'COMPETITION', p_competition_id, p_adult_profile_id,
                        pg_catalog.to_char(p_adult_birth_date, 'YYYY-MM-DD'),
                        p_category_id, p_route_id, p_gpx_storage_path, p_price_bani,
                        'RON', 1, NULL, p_price_bani, 'RON'
                    )::TEXT,
                    ', ', ','
                ),
                'UTF8'
            )
        ),
        'hex'
    )
$$;

REVOKE ALL ON FUNCTION public.competition_price_version(UUID, UUID, DATE, UUID, UUID, TEXT, BIGINT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.competition_price_version(UUID, UUID, DATE, UUID, UUID, TEXT, BIGINT)
    TO authenticated, service_role;

CREATE FUNCTION public.valid_competition_price_snapshot(
    p_snapshot JSONB,
    p_amount BIGINT,
    p_currency TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
    competition_id UUID;
    participant_id UUID;
    adult_birth_date DATE;
    has_child BOOLEAN;
    has_adult BOOLEAN;
    category_id UUID;
    route_id UUID;
    gpx_storage_path TEXT;
    price_bani BIGINT;
BEGIN
    IF p_snapshot IS NULL
        OR jsonb_typeof(p_snapshot) IS DISTINCT FROM 'object'
        OR NOT p_snapshot ?& ARRAY[
            'schemaVersion', 'kind', 'entityId', 'categoryId',
            'routeId', 'gpxStoragePath', 'sourceUnitAmount', 'sourceCurrency', 'quantity',
            'eurRonRateMicros', 'amount', 'currency', 'priceVersion'
        ]
        OR p_snapshot->'schemaVersion' IS DISTINCT FROM '2'::JSONB
        OR p_snapshot->>'kind' IS DISTINCT FROM 'COMPETITION'
        OR p_snapshot->>'sourceCurrency' IS DISTINCT FROM 'RON'
        OR p_snapshot->>'currency' IS DISTINCT FROM 'RON'
        OR p_currency IS DISTINCT FROM 'RON'
        OR p_snapshot->'quantity' IS DISTINCT FROM '1'::JSONB
        OR p_snapshot->'eurRonRateMicros' IS DISTINCT FROM 'null'::JSONB
        OR jsonb_typeof(p_snapshot->'sourceUnitAmount') IS DISTINCT FROM 'number'
        OR jsonb_typeof(p_snapshot->'amount') IS DISTINCT FROM 'number'
        OR (p_snapshot->>'entityId' ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') IS DISTINCT FROM TRUE
        OR (p_snapshot->>'categoryId' ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') IS DISTINCT FROM TRUE
        OR (p_snapshot->>'routeId' ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') IS DISTINCT FROM TRUE
        OR jsonb_typeof(p_snapshot->'gpxStoragePath') IS DISTINCT FROM 'string'
        OR (p_snapshot->>'gpxStoragePath' ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/routes/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.gpx$') IS DISTINCT FROM TRUE
        OR (p_snapshot->>'priceVersion' ~ '^[0-9a-f]{64}$') IS DISTINCT FROM TRUE
    THEN
        RETURN FALSE;
    END IF;

    has_child := p_snapshot->>'childId' IS NOT NULL;
    has_adult := p_snapshot ? 'adultProfileId';
    IF has_child = has_adult
        OR (has_child AND p_snapshot ? 'adultBirthDate')
        OR (has_child AND (p_snapshot->>'childId' ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') IS DISTINCT FROM TRUE)
        OR (has_adult AND p_snapshot->'childId' IS DISTINCT FROM 'null'::JSONB)
        OR (has_adult AND (p_snapshot->>'adultProfileId' ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') IS DISTINCT FROM TRUE)
        OR (has_adult AND (p_snapshot->>'adultBirthDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') IS DISTINCT FROM TRUE)
    THEN
        RETURN FALSE;
    END IF;

    competition_id := (p_snapshot->>'entityId')::UUID;
    participant_id := COALESCE(p_snapshot->>'childId', p_snapshot->>'adultProfileId')::UUID;
    IF has_adult THEN
        adult_birth_date := (p_snapshot->>'adultBirthDate')::DATE;
        IF pg_catalog.to_char(adult_birth_date, 'YYYY-MM-DD') IS DISTINCT FROM p_snapshot->>'adultBirthDate' THEN
            RETURN FALSE;
        END IF;
    END IF;
    category_id := (p_snapshot->>'categoryId')::UUID;
    route_id := (p_snapshot->>'routeId')::UUID;
    gpx_storage_path := p_snapshot->>'gpxStoragePath';
    price_bani := (p_snapshot->>'sourceUnitAmount')::BIGINT;

    RETURN price_bani BETWEEN 0 AND 99999999
        AND price_bani = p_amount
        AND p_snapshot->'sourceUnitAmount' IS NOT DISTINCT FROM to_jsonb(price_bani)
        AND p_snapshot->'amount' IS NOT DISTINCT FROM to_jsonb(price_bani)
        AND p_snapshot->>'priceVersion' = CASE WHEN has_adult THEN
            public.competition_price_version(
                competition_id, participant_id, adult_birth_date,
                category_id, route_id, gpx_storage_path, price_bani
            )
        ELSE
            public.competition_price_version(
                competition_id, participant_id, category_id,
                route_id, gpx_storage_path, price_bani
            )
        END;
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format
    OR datetime_field_overflow OR numeric_value_out_of_range THEN
    RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.valid_competition_price_snapshot(JSONB, BIGINT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.valid_competition_price_snapshot(JSONB, BIGINT, TEXT)
    TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.valid_enrollment_price_snapshot(
    p_snapshot JSONB,
    p_amount BIGINT,
    p_currency TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
    v_unit NUMERIC;
    v_quantity NUMERIC;
    v_rate NUMERIC;
    v_source NUMERIC;
    v_result NUMERIC;
    v_has_child BOOLEAN;
    v_has_adult BOOLEAN;
BEGIN
    IF p_snapshot IS NULL THEN RETURN TRUE; END IF;
    IF p_snapshot->'schemaVersion' = '2'::JSONB THEN
        RETURN public.valid_competition_price_snapshot(p_snapshot, p_amount, p_currency);
    END IF;
    IF jsonb_typeof(p_snapshot) IS DISTINCT FROM 'object'
        OR NOT p_snapshot ?& ARRAY['schemaVersion','kind','entityId','childId','sourceUnitAmount',
            'sourceCurrency','quantity','eurRonRateMicros','amount','currency','priceVersion']
        OR p_snapshot->'schemaVersion' IS DISTINCT FROM '1'::JSONB
        OR (p_snapshot->>'kind' IN ('COURSE','CAMP','ACTIVITY')) IS DISTINCT FROM TRUE
        OR (p_snapshot->>'sourceCurrency' IN ('RON','EUR')) IS DISTINCT FROM TRUE
        OR p_snapshot->>'currency' IS DISTINCT FROM 'RON' OR p_currency IS DISTINCT FROM 'RON'
        OR (p_snapshot->>'entityId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS DISTINCT FROM TRUE
        OR (p_snapshot->>'priceVersion' ~ '^[0-9a-f]{64}$') IS DISTINCT FROM TRUE
        OR jsonb_typeof(p_snapshot->'sourceUnitAmount') IS DISTINCT FROM 'number'
        OR jsonb_typeof(p_snapshot->'quantity') IS DISTINCT FROM 'number'
        OR jsonb_typeof(p_snapshot->'amount') IS DISTINCT FROM 'number'
    THEN RETURN FALSE; END IF;
    v_has_child := (p_snapshot->>'childId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS TRUE;
    v_has_adult := (p_snapshot->>'adultProfileId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS TRUE;
    IF v_has_child = v_has_adult THEN RETURN FALSE; END IF;
    IF v_has_adult AND p_snapshot->>'kind' IS DISTINCT FROM 'CAMP' THEN RETURN FALSE; END IF;
    v_unit := (p_snapshot->>'sourceUnitAmount')::NUMERIC;
    v_quantity := (p_snapshot->>'quantity')::NUMERIC;
    IF v_unit <> trunc(v_unit) OR v_unit NOT BETWEEN 0 AND 9007199254740991
        OR v_quantity <> trunc(v_quantity) OR v_quantity NOT BETWEEN 1 AND 9007199254740991
        OR (p_snapshot->>'kind' <> 'COURSE' AND v_quantity <> 1)
    THEN RETURN FALSE; END IF;
    v_source := v_unit * v_quantity;
    IF v_source > 9007199254740991 THEN RETURN FALSE; END IF;
    IF p_snapshot->>'sourceCurrency' = 'EUR' THEN
        IF jsonb_typeof(p_snapshot->'eurRonRateMicros') IS DISTINCT FROM 'number' THEN RETURN FALSE; END IF;
        v_rate := (p_snapshot->>'eurRonRateMicros')::NUMERIC;
        IF v_rate <> trunc(v_rate) OR v_rate NOT BETWEEN 1 AND 9007199254740991 THEN RETURN FALSE; END IF;
        v_result := floor((v_source * v_rate + 500000) / 1000000);
    ELSE
        IF p_snapshot->'eurRonRateMicros' IS DISTINCT FROM 'null'::JSONB THEN RETURN FALSE; END IF;
        v_result := v_source;
    END IF;
    RETURN (v_result <= 9007199254740991 AND v_result = p_amount
        AND v_result = (p_snapshot->>'amount')::NUMERIC) IS TRUE;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN FALSE;
END;
$$;

CREATE FUNCTION public.save_competition_registration(
    p_parent_id UUID,
    p_competition_id UUID,
    p_method TEXT,
    p_quotes JSONB,
    p_billing JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    competition public.competitions;
    actor public.profiles;
    child public.children;
    category public.competition_age_categories;
    route public.competition_routes;
    quote JSONB;
    snapshot JSONB;
    registration_child_id UUID;
    registration_adult_id UUID;
    adult_birth_date DATE;
    participant_id UUID;
    category_id UUID;
    enrollment_id UUID;
    price_bani BIGINT;
    age_at_registration INTEGER;
    registration_at TIMESTAMPTZ;
    registration_date DATE;
    payment_method TEXT;
    needs_card BOOLEAN := FALSE;
    enrollment_ids JSONB := '[]'::JSONB;
    prices JSONB := '[]'::JSONB;
BEGIN
    IF p_parent_id IS NULL OR p_competition_id IS NULL
        OR p_method NOT IN ('CARD', 'CASH')
        OR p_method IS NULL
        OR jsonb_typeof(p_quotes) IS DISTINCT FROM 'array'
        OR (p_billing IS NOT NULL AND jsonb_typeof(p_billing) IS DISTINCT FROM 'object') THEN
        RAISE EXCEPTION 'Cererea de înscriere la concurs nu este validă'
            USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_quotes) = 0 THEN
        RAISE EXCEPTION 'Selectează cel puțin un participant'
            USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_quotes) item
        WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
           OR ((item ? 'childId') = (item ? 'adultProfileId'))
           OR (item ? 'childId' AND (
               (item->>'childId' ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') IS DISTINCT FROM TRUE
               OR item ? 'adultBirthDate'
           ))
           OR (item ? 'adultProfileId' AND (
               (item->>'adultProfileId' ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') IS DISTINCT FROM TRUE
               OR (item->>'adultBirthDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') IS DISTINCT FROM TRUE
           ))
           OR (item->>'categoryId' ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') IS DISTINCT FROM TRUE
           OR jsonb_typeof(item->'amount') IS DISTINCT FROM 'number'
           OR (item->>'amount' ~ '^(0|[1-9][0-9]*)$') IS DISTINCT FROM TRUE
           OR item->>'currency' IS DISTINCT FROM 'RON'
           OR (item->>'priceVersion' ~ '^[0-9a-f]{64}$') IS DISTINCT FROM TRUE
           OR jsonb_typeof(item->'snapshot') IS DISTINCT FROM 'object'
    ) THEN
        RAISE EXCEPTION 'Oferta confirmată nu este validă'
            USING ERRCODE = '22023';
    END IF;
    IF (
        SELECT count(DISTINCT COALESCE(item->>'childId', item->>'adultProfileId'))
        FROM jsonb_array_elements(p_quotes) item
    ) <> jsonb_array_length(p_quotes) THEN
        RAISE EXCEPTION 'Același participant nu poate fi selectat de două ori'
            USING ERRCODE = '22023';
    END IF;

    SELECT * INTO actor FROM public.profiles profile
    WHERE profile.id = p_parent_id AND profile.enabled IS TRUE FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profilul participantului nu este disponibil'
            USING ERRCODE = '42501';
    END IF;
    IF actor.role IS DISTINCT FROM 'PARENT' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_quotes) item WHERE item ? 'childId'
    ) THEN
        RAISE EXCEPTION 'Doar părinții pot înscrie copii'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO competition FROM public.competitions
    WHERE id = p_competition_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Concursul nu a fost găsit'
            USING ERRCODE = 'P0002';
    END IF;

    registration_at := clock_timestamp();
    IF competition.start_at IS NULL
        OR competition.registration_deadline_at IS NULL
        OR registration_at > competition.registration_deadline_at
        OR registration_at >= competition.start_at THEN
        RAISE EXCEPTION 'Înscrierile la acest concurs s-au închis'
            USING ERRCODE = '23514';
    END IF;
    registration_date := (registration_at AT TIME ZONE 'Europe/Bucharest')::DATE;

    FOR quote IN
        SELECT item FROM jsonb_array_elements(p_quotes) item
        ORDER BY COALESCE(item->>'childId', item->>'adultProfileId')
    LOOP
        registration_child_id := (quote->>'childId')::UUID;
        registration_adult_id := (quote->>'adultProfileId')::UUID;
        participant_id := COALESCE(registration_child_id, registration_adult_id);
        adult_birth_date := NULL;
        IF registration_adult_id IS NOT NULL THEN
            adult_birth_date := (quote->>'adultBirthDate')::DATE;
            IF pg_catalog.to_char(adult_birth_date, 'YYYY-MM-DD') IS DISTINCT FROM quote->>'adultBirthDate' THEN
                RAISE EXCEPTION 'Data nașterii nu este validă' USING ERRCODE = '22023';
            END IF;
        END IF;
        category_id := (quote->>'categoryId')::UUID;
        price_bani := (quote->>'amount')::BIGINT;
        snapshot := quote->'snapshot';
        IF price_bani NOT BETWEEN 0 AND 99999999
            OR public.valid_enrollment_price_snapshot(snapshot, price_bani, 'RON') IS DISTINCT FROM TRUE
            OR snapshot->>'entityId' IS DISTINCT FROM p_competition_id::TEXT
            OR (registration_child_id IS NOT NULL AND (
                snapshot->>'childId' IS DISTINCT FROM registration_child_id::TEXT
                OR snapshot ? 'adultProfileId'
            ))
            OR (registration_adult_id IS NOT NULL AND (
                registration_adult_id IS DISTINCT FROM p_parent_id
                OR snapshot->>'adultProfileId' IS DISTINCT FROM registration_adult_id::TEXT
                OR snapshot->>'adultBirthDate' IS DISTINCT FROM quote->>'adultBirthDate'
                OR snapshot->'childId' IS DISTINCT FROM 'null'::JSONB
            ))
            OR snapshot->>'categoryId' IS DISTINCT FROM category_id::TEXT
            OR snapshot->>'priceVersion' IS DISTINCT FROM quote->>'priceVersion' THEN
            RAISE EXCEPTION 'Oferta confirmată nu este validă'
                USING ERRCODE = '23514';
        END IF;

        IF registration_child_id IS NOT NULL THEN
            SELECT * INTO child FROM public.children
            WHERE id = registration_child_id FOR SHARE;
            IF NOT FOUND OR child.parent_id IS DISTINCT FROM p_parent_id THEN
                RAISE EXCEPTION 'Copilul nu îți aparține'
                    USING ERRCODE = '42501';
            END IF;
        END IF;

        SELECT * INTO category FROM public.competition_age_categories
        WHERE id = category_id AND competition_id = p_competition_id FOR SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Categoria nu mai este disponibilă'
                USING ERRCODE = '23514', DETAIL = 'PRICE_CHANGED';
        END IF;

        SELECT * INTO route FROM public.competition_routes
        WHERE id = category.route_id AND competition_id = p_competition_id FOR SHARE;
        IF NOT FOUND OR route.gpx_storage_path IS NULL THEN
            RAISE EXCEPTION 'Traseul concursului nu are un fișier GPX disponibil'
                USING ERRCODE = '23514';
        END IF;
        PERFORM 1 FROM storage.objects object
        WHERE object.bucket_id = 'competition-routes'
          AND object.name = route.gpx_storage_path
        FOR SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Traseul concursului nu are un fișier GPX disponibil'
                USING ERRCODE = '23514';
        END IF;

        age_at_registration := public.varsta_la_data(
            CASE WHEN registration_child_id IS NOT NULL THEN child.birth_date ELSE adult_birth_date END,
            registration_date
        );
        IF registration_adult_id IS NOT NULL AND age_at_registration < 18 THEN
            RAISE EXCEPTION 'Înscrierea proprie este disponibilă doar adulților'
                USING ERRCODE = '23514';
        END IF;
        IF age_at_registration NOT BETWEEN category.age_from AND category.age_to THEN
            RAISE EXCEPTION 'Vârsta participantului nu corespunde categoriei alese'
                USING ERRCODE = '23514';
        END IF;
        IF category.price_bani IS DISTINCT FROM price_bani
            OR snapshot->>'routeId' IS DISTINCT FROM route.id::TEXT
            OR snapshot->>'gpxStoragePath' IS DISTINCT FROM route.gpx_storage_path
            OR snapshot->>'priceVersion' IS DISTINCT FROM (CASE
                WHEN registration_adult_id IS NOT NULL THEN public.competition_price_version(
                    p_competition_id, participant_id, adult_birth_date, category.id,
                    route.id, route.gpx_storage_path, category.price_bani
                )
                ELSE public.competition_price_version(
                    p_competition_id, participant_id, category.id, route.id,
                    route.gpx_storage_path, category.price_bani
                )
            END) THEN
            RAISE EXCEPTION 'Prețul sau traseul s-a schimbat. Confirmă din nou oferta'
                USING ERRCODE = '23514', DETAIL = 'PRICE_CHANGED';
        END IF;

        IF EXISTS (
            SELECT 1 FROM public.enrollments enrollment
            WHERE enrollment.kind = 'COMPETITION'
              AND enrollment.entity_id = p_competition_id
              AND (
                  enrollment.child_id = registration_child_id
                  OR enrollment.adult_profile_id = registration_adult_id
              )
              AND enrollment.status IN ('PENDING', 'ACTIVE')
        ) THEN
            RAISE EXCEPTION 'Există deja o înscriere. Verifică în Înscrieri'
                USING ERRCODE = '23514';
        END IF;

        IF price_bani > 0 AND p_method = 'CASH' AND competition.allow_cash IS DISTINCT FROM TRUE THEN
            RAISE EXCEPTION 'Plata cash nu este disponibilă pentru acest concurs'
                USING ERRCODE = '23514';
        END IF;

        payment_method := CASE WHEN price_bani = 0 THEN 'CARD' ELSE p_method END;
        INSERT INTO public.enrollments (
            kind, entity_id, child_id, adult_profile_id, status,
            purchased_sessions, remaining_sessions, sessions_used
        ) VALUES (
            'COMPETITION', p_competition_id, registration_child_id, registration_adult_id,
            CASE WHEN price_bani = 0 THEN 'ACTIVE' ELSE 'PENDING' END,
            0, 0, 0
        ) RETURNING id INTO enrollment_id;

        INSERT INTO public.competition_registrations (
            enrollment_id, competition_id, category_id, route_id,
            category_name_snapshot, route_name_snapshot, gpx_storage_path_snapshot,
            adult_profile_id, adult_birth_date, age_at_registration,
            accepted_price_bani, registered_at
        ) VALUES (
            enrollment_id, p_competition_id, category.id, route.id,
            category.name, route.name, route.gpx_storage_path,
            registration_adult_id, adult_birth_date, age_at_registration,
            price_bani, registration_at
        );

        INSERT INTO public.payments (
            enrollment_id, method, amount, currency, pricing_snapshot,
            status, paid_at, billing_name, billing_email,
            billing_address_line1, billing_city, billing_postal_code, billing_country
        ) VALUES (
            enrollment_id, payment_method, price_bani, 'RON', snapshot,
            CASE WHEN price_bani = 0 THEN 'SUCCEEDED' ELSE 'PENDING' END,
            CASE WHEN price_bani = 0 THEN registration_at END,
            CASE WHEN payment_method = 'CARD' AND price_bani > 0 THEN p_billing->>'name' END,
            CASE WHEN payment_method = 'CARD' AND price_bani > 0 THEN p_billing->>'email' END,
            CASE WHEN payment_method = 'CARD' AND price_bani > 0 THEN p_billing->>'addressLine1' END,
            CASE WHEN payment_method = 'CARD' AND price_bani > 0 THEN p_billing->>'city' END,
            CASE WHEN payment_method = 'CARD' AND price_bani > 0 THEN p_billing->>'postalCode' END,
            CASE WHEN payment_method = 'CARD' AND price_bani > 0 AND p_billing IS NOT NULL THEN 'RO' END
        );

        enrollment_ids := enrollment_ids || jsonb_build_array(enrollment_id);
        prices := prices || jsonb_build_array(
            jsonb_build_object('amount', price_bani, 'currency', 'RON') ||
            CASE WHEN registration_adult_id IS NOT NULL THEN
                jsonb_build_object('adultProfileId', registration_adult_id, 'participantKey', 'self')
            ELSE jsonb_build_object('childId', registration_child_id) END
        );
        needs_card := needs_card OR (payment_method = 'CARD' AND price_bani > 0);
    END LOOP;

    RETURN jsonb_build_object(
        'enrollmentId', enrollment_ids->>0,
        'enrollmentIds', enrollment_ids,
        'createdEnrollmentIds', enrollment_ids,
        'prices', prices,
        'requiresPaymentIntent', needs_card
    );
END;
$$;

REVOKE ALL ON FUNCTION public.save_competition_registration(UUID, UUID, TEXT, JSONB, JSONB)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_competition_registration(UUID, UUID, TEXT, JSONB, JSONB)
    TO service_role;
