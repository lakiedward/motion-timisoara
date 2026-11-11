DO $guard$
BEGIN
    IF (
        SELECT md5(replace(p.prosrc, E'\r', ''))
        FROM pg_proc p
        WHERE p.oid = 'public.save_competition_registration(uuid, uuid, text, jsonb, jsonb)'::regprocedure
    ) IS DISTINCT FROM 'af6b6dc188abc59c58546b342d252f4a'
        OR (
            SELECT md5(replace(p.prosrc, E'\r', ''))
            FROM pg_proc p
            WHERE p.oid = 'public.valid_competition_price_snapshot(jsonb, bigint, text)'::regprocedure
        ) IS DISTINCT FROM 'd9ee7a21b0f7eba3510ad70f407826d2' THEN
        RAISE EXCEPTION 'Funcțiile de înscriere la concurs diferă de 00072; revizuiește migrația 00139';
    END IF;
END;
$guard$;

ALTER TABLE public.competition_registrations
    ALTER COLUMN gpx_storage_path_snapshot DROP NOT NULL;

ALTER TABLE public.competition_registrations
    DROP CONSTRAINT competition_registrations_gpx_path_ck;
ALTER TABLE public.competition_registrations
    ADD CONSTRAINT competition_registrations_gpx_path_ck CHECK (
        gpx_storage_path_snapshot IS NULL
        OR gpx_storage_path_snapshot ~ (
            '^' || competition_id::TEXT || '/routes/' || route_id::TEXT ||
            '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.gpx$'
        )
    );

CREATE OR REPLACE FUNCTION public.valid_competition_price_snapshot(
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
        OR COALESCE(jsonb_typeof(p_snapshot->'gpxStoragePath'), 'missing') NOT IN ('string', 'null')
        OR (jsonb_typeof(p_snapshot->'gpxStoragePath') = 'string'
            AND (p_snapshot->>'gpxStoragePath' ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/routes/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.gpx$') IS DISTINCT FROM TRUE)
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

CREATE OR REPLACE FUNCTION public.save_competition_registration(
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
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Proba concursului nu mai este disponibilă'
                USING ERRCODE = '23514';
        END IF;
        IF route.gpx_storage_path IS NOT NULL THEN
            PERFORM 1 FROM storage.objects object
            WHERE object.bucket_id = 'competition-routes'
              AND object.name = route.gpx_storage_path
            FOR SHARE;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Traseul concursului nu are un fișier GPX disponibil'
                    USING ERRCODE = '23514';
            END IF;
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
