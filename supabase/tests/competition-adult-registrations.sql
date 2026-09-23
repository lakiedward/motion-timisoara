INSERT INTO public.competition_age_categories(
    competition_id, route_id, name, age_from, age_to, price_bani
) VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '18–39 ani', 18, 39, 0),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '40–69 ani', 40, 69, 6000);

UPDATE public.competitions SET allow_cash = TRUE
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

CREATE FUNCTION public.test_competition_adult_quote(
    p_profile_id UUID,
    p_birth_date DATE,
    p_category_id UUID,
    p_price_bani BIGINT
)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
    SELECT jsonb_build_object(
        'adultProfileId', p_profile_id,
        'adultBirthDate', to_char(p_birth_date, 'YYYY-MM-DD'),
        'categoryId', p_category_id,
        'amount', p_price_bani,
        'currency', 'RON',
        'priceVersion', public.competition_price_version(
            'dddddddd-dddd-dddd-dddd-dddddddddddd', p_profile_id,
            p_birth_date, p_category_id,
            'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
            'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/ffffffff-ffff-ffff-ffff-ffffffffffff.gpx',
            p_price_bani
        ),
        'snapshot', jsonb_build_object(
            'schemaVersion', 2,
            'kind', 'COMPETITION',
            'entityId', 'dddddddd-dddd-dddd-dddd-dddddddddddd',
            'childId', NULL,
            'adultProfileId', p_profile_id,
            'adultBirthDate', to_char(p_birth_date, 'YYYY-MM-DD'),
            'categoryId', p_category_id,
            'routeId', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
            'gpxStoragePath', 'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/ffffffff-ffff-ffff-ffff-ffffffffffff.gpx',
            'sourceUnitAmount', p_price_bani,
            'sourceCurrency', 'RON',
            'quantity', 1,
            'eurRonRateMicros', NULL,
            'amount', p_price_bani,
            'currency', 'RON',
            'priceVersion', public.competition_price_version(
                'dddddddd-dddd-dddd-dddd-dddddddddddd', p_profile_id,
                p_birth_date, p_category_id,
                'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
                'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/ffffffff-ffff-ffff-ffff-ffffffffffff.gpx',
                p_price_bani
            )
        )
    )
$$;

DO $$
DECLARE
    free_category UUID;
    paid_category UUID;
    free_quote JSONB;
    cash_quote JSONB;
    card_quote JSONB;
    result JSONB;
    registration_date DATE := (clock_timestamp() AT TIME ZONE 'Europe/Bucharest')::DATE;
BEGIN
    SELECT id INTO free_category FROM public.competition_age_categories WHERE age_from = 18;
    SELECT id INTO paid_category FROM public.competition_age_categories WHERE age_from = 40;

    free_quote := public.test_competition_adult_quote(
        '33333333-3333-3333-3333-333333333333', DATE '1990-01-15', free_category, 0
    );
    cash_quote := public.test_competition_adult_quote(
        '11111111-1111-1111-1111-111111111111', DATE '1970-01-15', paid_category, 6000
    );
    card_quote := public.test_competition_adult_quote(
        '22222222-2222-2222-2222-222222222222', DATE '1975-01-15', paid_category, 6000
    );

    IF public.valid_enrollment_price_snapshot(free_quote->'snapshot', 0, 'RON') IS DISTINCT FROM TRUE
        OR public.valid_enrollment_price_snapshot(cash_quote->'snapshot', 6000, 'RON') IS DISTINCT FROM TRUE
        OR public.valid_enrollment_price_snapshot(
            jsonb_set(cash_quote->'snapshot', '{adultBirthDate}', to_jsonb('1971-01-15'::TEXT)),
            6000, 'RON'
        ) IS DISTINCT FROM FALSE
        OR public.valid_enrollment_price_snapshot(
            jsonb_set(cash_quote->'snapshot', '{childId}', to_jsonb('11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::TEXT)),
            6000, 'RON'
        ) IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION 'Adult competition snapshot validation failed';
    END IF;

    BEGIN
        PERFORM public.save_competition_registration(
            '11111111-1111-1111-1111-111111111111',
            'dddddddd-dddd-dddd-dddd-dddddddddddd', 'CASH',
            jsonb_build_array(free_quote), NULL
        );
        RAISE EXCEPTION 'Adult quote for another profile was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        PERFORM public.save_competition_registration(
            '33333333-3333-3333-3333-333333333333',
            'dddddddd-dddd-dddd-dddd-dddddddddddd', 'CARD',
            jsonb_build_array(jsonb_build_object(
                'childId', '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                'categoryId', free_category, 'amount', 0, 'currency', 'RON',
                'priceVersion', repeat('0', 64), 'snapshot', '{}'::JSONB
            )), NULL
        );
        RAISE EXCEPTION 'Nonparent enrolled a child';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    BEGIN
        PERFORM public.save_competition_registration(
            '33333333-3333-3333-3333-333333333333',
            'dddddddd-dddd-dddd-dddd-dddddddddddd', 'CARD',
            jsonb_build_array(jsonb_set(
                free_quote, '{adultBirthDate}', to_jsonb('1990-02-30'::TEXT)
            )), NULL
        );
        RAISE EXCEPTION 'Invalid adult birth date was accepted';
    EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN NULL;
    END;

    BEGIN
        PERFORM public.save_competition_registration(
            '33333333-3333-3333-3333-333333333333',
            'dddddddd-dddd-dddd-dddd-dddddddddddd', 'CARD',
            jsonb_build_array(public.test_competition_adult_quote(
                '33333333-3333-3333-3333-333333333333', DATE '2015-01-15', free_category, 0
            )), NULL
        );
        RAISE EXCEPTION 'Underage self registration was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        PERFORM public.save_competition_registration(
            '33333333-3333-3333-3333-333333333333',
            'dddddddd-dddd-dddd-dddd-dddddddddddd', 'CARD',
            jsonb_build_array(public.test_competition_adult_quote(
                '33333333-3333-3333-3333-333333333333', DATE '2990-01-15', free_category, 0
            )), NULL
        );
        RAISE EXCEPTION 'Future birth date was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    result := public.save_competition_registration(
        '33333333-3333-3333-3333-333333333333',
        'dddddddd-dddd-dddd-dddd-dddddddddddd', 'CARD',
        jsonb_build_array(free_quote), NULL
    );
    IF (result->>'requiresPaymentIntent')::BOOLEAN IS DISTINCT FROM FALSE
        OR result->'prices'->0->>'participantKey' IS DISTINCT FROM 'self'
        OR (SELECT count(*) FROM public.enrollments
            WHERE kind = 'COMPETITION' AND adult_profile_id = '33333333-3333-3333-3333-333333333333'
                AND child_id IS NULL AND status = 'ACTIVE') <> 1
        OR (SELECT count(*) FROM public.competition_registrations
            WHERE adult_profile_id = '33333333-3333-3333-3333-333333333333'
              AND adult_birth_date = DATE '1990-01-15'
              AND age_at_registration = public.varsta_la_data(DATE '1990-01-15', registration_date)) <> 1
        OR (SELECT count(*) FROM public.payments payment
            JOIN public.enrollments enrollment ON enrollment.id = payment.enrollment_id
            WHERE enrollment.adult_profile_id = '33333333-3333-3333-3333-333333333333'
              AND payment.amount = 0 AND payment.status = 'SUCCEEDED') <> 1 THEN
        RAISE EXCEPTION 'Free adult competition registration failed';
    END IF;

    result := public.save_competition_registration(
        '11111111-1111-1111-1111-111111111111',
        'dddddddd-dddd-dddd-dddd-dddddddddddd', 'CASH',
        jsonb_build_array(cash_quote), NULL
    );
    IF (result->>'requiresPaymentIntent')::BOOLEAN IS DISTINCT FROM FALSE
        OR (SELECT count(*) FROM public.payments payment
            JOIN public.enrollments enrollment ON enrollment.id = payment.enrollment_id
            WHERE enrollment.adult_profile_id = '11111111-1111-1111-1111-111111111111'
              AND payment.amount = 6000 AND payment.method = 'CASH' AND payment.status = 'PENDING') <> 1 THEN
        RAISE EXCEPTION 'Cash adult competition registration failed';
    END IF;

    result := public.save_competition_registration(
        '22222222-2222-2222-2222-222222222222',
        'dddddddd-dddd-dddd-dddd-dddddddddddd', 'CARD',
        jsonb_build_array(card_quote), jsonb_build_object(
            'name', 'Alt Club', 'email', 'adult@example.test',
            'addressLine1', 'Strada Unu', 'city', 'Timișoara', 'postalCode', '300001'
        )
    );
    IF (result->>'requiresPaymentIntent')::BOOLEAN IS DISTINCT FROM TRUE
        OR (SELECT count(*) FROM public.payments payment
            JOIN public.enrollments enrollment ON enrollment.id = payment.enrollment_id
            WHERE enrollment.adult_profile_id = '22222222-2222-2222-2222-222222222222'
              AND payment.amount = 6000 AND payment.method = 'CARD' AND payment.status = 'PENDING') <> 1 THEN
        RAISE EXCEPTION 'Card adult competition registration failed';
    END IF;

    BEGIN
        PERFORM public.save_competition_registration(
            '33333333-3333-3333-3333-333333333333',
            'dddddddd-dddd-dddd-dddd-dddddddddddd', 'CARD',
            jsonb_build_array(free_quote), NULL
        );
        RAISE EXCEPTION 'Duplicate adult competition registration was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        PERFORM public.save_competition_registration(
            '33333333-3333-3333-3333-333333333333',
            'dddddddd-dddd-dddd-dddd-dddddddddddd', 'CARD',
            jsonb_build_array(free_quote, free_quote), NULL
        );
        RAISE EXCEPTION 'Duplicate adult competition quote was accepted';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', TRUE);
SELECT set_config('request.jwt.claim.user_role', 'CLUB', TRUE);
SELECT set_config('request.jwt.claim.club', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', TRUE);
SET ROLE authenticated;
DO $$
BEGIN
    IF (SELECT count(*) FROM public.competition_registrations) <> 1
        OR (SELECT count(*) FROM public.enrollments WHERE kind = 'COMPETITION') <> 1
        OR (SELECT count(*) FROM public.payments) <> 1 THEN
        RAISE EXCEPTION 'Adult cannot read own registration or can read another participant';
    END IF;
    BEGIN
        PERFORM * FROM public.get_competition_cash_payments(
            'dddddddd-dddd-dddd-dddd-dddddddddddd'
        );
        RAISE EXCEPTION 'Unrelated adult can read organizer cash payments';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;
RESET ROLE;
