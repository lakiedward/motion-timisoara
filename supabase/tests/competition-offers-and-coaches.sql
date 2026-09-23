\set ON_ERROR_STOP on
BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END;
$$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', TRUE), '')::UUID
$$;

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE public.clubs (id UUID PRIMARY KEY, owner_user_id UUID NOT NULL REFERENCES public.profiles(id));
CREATE TABLE public.coach_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id)
);
CREATE TABLE public.locations (id UUID PRIMARY KEY);
CREATE TABLE public.children (
    id UUID PRIMARY KEY,
    parent_id UUID NOT NULL REFERENCES public.profiles(id),
    name TEXT NOT NULL,
    birth_date DATE NOT NULL
);
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL,
    entity_id UUID NOT NULL,
    child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
    adult_profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    purchased_sessions INTEGER NOT NULL DEFAULT 0,
    remaining_sessions INTEGER NOT NULL DEFAULT 0,
    sessions_used INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT enrollments_kind_check CHECK (kind IN ('COURSE', 'CAMP', 'ACTIVITY')),
    CONSTRAINT enrollments_participant_xor_ck CHECK (
        (child_id IS NOT NULL AND adult_profile_id IS NULL)
        OR (child_id IS NULL AND adult_profile_id IS NOT NULL AND kind = 'CAMP')
    )
);
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    amount BIGINT NOT NULL,
    currency TEXT NOT NULL,
    pricing_snapshot JSONB,
    status TEXT NOT NULL,
    paid_at TIMESTAMPTZ,
    billing_name TEXT,
    billing_email TEXT,
    billing_address_line1 TEXT,
    billing_city TEXT,
    billing_postal_code TEXT,
    billing_country TEXT
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE storage.buckets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    public BOOLEAN,
    file_size_limit BIGINT,
    allowed_mime_types TEXT[]
);
CREATE TABLE storage.objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id TEXT NOT NULL,
    name TEXT NOT NULL
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION storage.foldername(name TEXT) RETURNS TEXT[]
LANGUAGE sql IMMUTABLE AS $$
    SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

CREATE FUNCTION public.safe_uuid(value TEXT) RETURNS UUID
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    RETURN value::UUID;
EXCEPTION WHEN others THEN
    RETURN NULL;
END;
$$;

CREATE FUNCTION public.my_club_ids() RETURNS SETOF UUID
LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.club', TRUE), '')::UUID
$$;

CREATE FUNCTION public.get_my_role() RETURNS TEXT
LANGUAGE sql STABLE AS $$
    SELECT current_setting('request.jwt.claim.user_role', TRUE)
$$;

CREATE FUNCTION public.my_child_ids() RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT id FROM public.children WHERE parent_id = auth.uid()
$$;

CREATE FUNCTION public.varsta_la_data(p_birth_date DATE, p_at DATE)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
    SELECT extract(year FROM age(p_at, p_birth_date))::INTEGER
$$;

GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.safe_uuid(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_club_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_child_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.varsta_la_data(DATE, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION storage.foldername(TEXT) TO authenticated;
GRANT SELECT ON public.coach_profiles TO authenticated;
GRANT SELECT ON public.enrollments, public.payments TO authenticated;
GRANT SELECT, INSERT, DELETE ON storage.objects TO authenticated;

CREATE POLICY enrollments_owner_select ON public.enrollments
    FOR SELECT TO authenticated
    USING (child_id IN (SELECT public.my_child_ids()) OR adult_profile_id = (SELECT auth.uid()));
CREATE POLICY payments_owner_select ON public.payments
    FOR SELECT TO authenticated
    USING (enrollment_id IN (
        SELECT enrollment.id FROM public.enrollments enrollment
        WHERE enrollment.child_id IN (SELECT public.my_child_ids())
           OR enrollment.adult_profile_id = (SELECT auth.uid())
    ));

\i /tmp/migrations/00069_competitions.sql

INSERT INTO public.profiles(id, name, role) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Club Organizator', 'CLUB'),
    ('22222222-2222-2222-2222-222222222222', 'Alt Club', 'CLUB'),
    ('33333333-3333-3333-3333-333333333333', 'Antrenor Adult', 'COACH'),
    ('44444444-4444-4444-4444-444444444444', 'Părinte Adult', 'PARENT');
INSERT INTO public.clubs(id, owner_user_id) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222');
INSERT INTO public.coach_profiles(id, user_id) VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333');
INSERT INTO public.locations(id) VALUES ('99999999-9999-9999-9999-999999999999');
INSERT INTO public.children(id, parent_id, name, birth_date) VALUES
    ('11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'Copil Gratuit', current_date - INTERVAL '7 years'),
    ('22222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'Copil Plătit', current_date - INTERVAL '10 years');
INSERT INTO public.competitions(id, title, slug, description, club_id) VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Concurs existent', 'concurs-existent', 'Descriere', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

\i /tmp/migrations/00071_competition_offers_and_coaches.sql
\i /tmp/migrations/00072_competition_registrations.sql
\i /tmp/migrations/00073_competition_podium.sql
\i /tmp/migrations/00074_competition_route_photos.sql

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.competitions
        WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' AND start_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Existing competition was altered';
    END IF;

    BEGIN
        UPDATE public.competitions SET title = 'Modificat'
        WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
        RAISE EXCEPTION 'Legacy update without schedule should fail';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO public.competitions(title, slug, description, club_id)
        VALUES ('Fara program', 'fara-program', 'Descriere', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
        RAISE EXCEPTION 'New competition without schedule should fail';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END;
$$;

UPDATE public.competitions
SET start_at = now() + INTERVAL '30 days',
    end_at = now() + INTERVAL '30 days 5 hours',
    registration_deadline_at = now() + INTERVAL '30 days',
    location_text = 'Parcul Rozelor, Timișoara',
    location_id = '99999999-9999-9999-9999-999999999999'
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

DO $$
BEGIN
    BEGIN
        UPDATE public.competitions
        SET registration_deadline_at = start_at + INTERVAL '1 minute'
        WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
        RAISE EXCEPTION 'Deadline after start should fail';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        UPDATE public.competitions
        SET end_at = start_at
        WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
        RAISE EXCEPTION 'End equal to start should fail';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', TRUE);
SELECT set_config('request.jwt.claim.user_role', 'CLUB', TRUE);
SELECT set_config('request.jwt.claim.club', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', TRUE);
SET ROLE authenticated;

INSERT INTO public.competition_routes(id, competition_id, name, description)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Traseul scurt', 'O tură');
UPDATE public.competition_routes
SET gpx_storage_path = 'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/ffffffff-ffff-ffff-ffff-ffffffffffff.gpx'
WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

\i /tmp/competition-route-photos.sql

INSERT INTO public.competition_age_categories(competition_id, route_id, name, age_from, age_to, price_bani)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '6–8 ani', 6, 8, 0);
INSERT INTO public.competition_age_categories(competition_id, route_id, name, age_from, age_to, price_bani)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '9–12 ani', 9, 12, 5000);

DO $$
BEGIN
    BEGIN
        INSERT INTO public.competition_age_categories(competition_id, route_id, name, age_from, age_to, price_bani)
        VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '8–10 ani', 8, 10, 1000);
        RAISE EXCEPTION 'Inclusive age overlap should fail';
    EXCEPTION WHEN exclusion_violation THEN NULL;
    END;

    BEGIN
        UPDATE public.competition_routes
        SET gpx_storage_path = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/ffffffff-ffff-ffff-ffff-ffffffffffff.gpx'
        WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
        RAISE EXCEPTION 'Foreign competition GPX path should fail';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END;
$$;

INSERT INTO storage.objects(bucket_id, name)
VALUES (
    'competition-routes',
    'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/ffffffff-ffff-ffff-ffff-ffffffffffff.gpx'
);

DO $$
BEGIN
    BEGIN
        INSERT INTO storage.objects(bucket_id, name)
        VALUES ('competition-routes', 'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/00000000-0000-0000-0000-000000000000/ffffffff-ffff-ffff-ffff-ffffffffffff.gpx');
        RAISE EXCEPTION 'Upload for missing route should fail';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;

INSERT INTO public.competition_coaches(competition_id, coach_profile_id)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc');

DO $$
BEGIN
    IF (SELECT status FROM public.competition_coaches WHERE competition_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd') <> 'invited' THEN
        RAISE EXCEPTION 'Invitations must begin as invited';
    END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', TRUE);
SELECT set_config('request.jwt.claim.club', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', TRUE);

DO $$
BEGIN
    BEGIN
        INSERT INTO public.competition_routes(competition_id, name, description)
        VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Străin', 'Descriere');
        RAISE EXCEPTION 'Nonowner route insert should fail';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    BEGIN
        DELETE FROM public.competition_coaches
        WHERE competition_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
        IF FOUND THEN RAISE EXCEPTION 'Nonowner invitation delete should fail'; END IF;
    END;

    BEGIN
        PERFORM public.respond_to_competition_invitation('dddddddd-dddd-dddd-dddd-dddddddddddd', TRUE);
        RAISE EXCEPTION 'Noninvitee response should fail';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM = 'Noninvitee response should fail' THEN RAISE; END IF;
    END;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', TRUE);
SELECT set_config('request.jwt.claim.user_role', 'COACH', TRUE);
SELECT set_config('request.jwt.claim.club', '', TRUE);

DO $$
BEGIN
    IF (SELECT count(*) FROM public.competition_coaches WHERE status = 'invited') <> 1 THEN
        RAISE EXCEPTION 'Invitee cannot see own pending invitation';
    END IF;
    IF (public.respond_to_competition_invitation('dddddddd-dddd-dddd-dddd-dddddddddddd', TRUE)).status <> 'accepted' THEN
        RAISE EXCEPTION 'Invitee response did not accept';
    END IF;
END;
$$;

RESET ROLE;
SET ROLE anon;
DO $$
BEGIN
    IF (SELECT count(*) FROM public.competition_routes) <> 1 THEN
        RAISE EXCEPTION 'Routes are not public';
    END IF;
    IF (SELECT count(*) FROM public.competition_age_categories) <> 2 THEN
        RAISE EXCEPTION 'Categories are not public';
    END IF;
    IF (SELECT count(*) FROM public.competition_coaches) <> 1 THEN
        RAISE EXCEPTION 'Accepted coaches are not public';
    END IF;
END;
$$;

RESET ROLE;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM storage.buckets
        WHERE id = 'competition-routes'
          AND public IS TRUE
          AND file_size_limit = 2097152
          AND 'application/gpx+xml' = ANY(allowed_mime_types)
    ) THEN
        RAISE EXCEPTION 'GPX bucket settings are missing';
    END IF;
END;
$$;

ALTER TABLE public.payments ADD CONSTRAINT payments_price_snapshot_check
    CHECK (public.valid_enrollment_price_snapshot(pricing_snapshot, amount, currency));

DO $$
DECLARE
    free_category UUID;
    paid_category UUID;
    free_version TEXT;
    paid_version TEXT;
    free_snapshot JSONB;
    paid_snapshot JSONB;
    result JSONB;
    route_path TEXT := 'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/ffffffff-ffff-ffff-ffff-ffffffffffff.gpx';
BEGIN
    SELECT id INTO free_category FROM public.competition_age_categories WHERE price_bani = 0;
    SELECT id INTO paid_category FROM public.competition_age_categories WHERE price_bani = 5000;

    free_version := public.competition_price_version(
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', free_category,
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', route_path, 0
    );
    paid_version := public.competition_price_version(
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        '22222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', paid_category,
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', route_path, 5000
    );
    free_snapshot := jsonb_build_object(
        'schemaVersion', 2, 'kind', 'COMPETITION',
        'entityId', 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'childId', '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'categoryId', free_category, 'routeId', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        'gpxStoragePath', route_path, 'sourceUnitAmount', 0,
        'sourceCurrency', 'RON', 'quantity', 1, 'eurRonRateMicros', NULL,
        'amount', 0, 'currency', 'RON', 'priceVersion', free_version
    );
    paid_snapshot := jsonb_build_object(
        'schemaVersion', 2, 'kind', 'COMPETITION',
        'entityId', 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'childId', '22222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'categoryId', paid_category, 'routeId', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        'gpxStoragePath', route_path, 'sourceUnitAmount', 5000,
        'sourceCurrency', 'RON', 'quantity', 1, 'eurRonRateMicros', NULL,
        'amount', 5000, 'currency', 'RON', 'priceVersion', paid_version
    );

    IF public.valid_enrollment_price_snapshot(free_snapshot, 0, 'RON') IS DISTINCT FROM TRUE
        OR public.valid_enrollment_price_snapshot(paid_snapshot, 5000, 'RON') IS DISTINCT FROM TRUE
        OR public.valid_enrollment_price_snapshot(
            jsonb_set(paid_snapshot, '{priceVersion}', to_jsonb(free_version)), 5000, 'RON'
        ) IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION 'Competition snapshot validation failed';
    END IF;

    UPDATE public.competition_routes SET gpx_storage_path = NULL
    WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
    BEGIN
        PERFORM public.save_competition_registration(
            '44444444-4444-4444-4444-444444444444',
            'dddddddd-dddd-dddd-dddd-dddddddddddd', 'CARD',
            jsonb_build_array(jsonb_build_object(
                'childId', '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                'categoryId', free_category, 'amount', 0, 'currency', 'RON',
                'priceVersion', free_version, 'snapshot', free_snapshot
            )), NULL
        );
        RAISE EXCEPTION 'A route without GPX should not accept registrations';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    UPDATE public.competition_routes SET gpx_storage_path = route_path
    WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

    result := public.save_competition_registration(
        '44444444-4444-4444-4444-444444444444',
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'CARD',
        jsonb_build_array(
            jsonb_build_object('childId', '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                'categoryId', free_category, 'amount', 0, 'currency', 'RON',
                'priceVersion', free_version, 'snapshot', free_snapshot),
            jsonb_build_object('childId', '22222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                'categoryId', paid_category, 'amount', 5000, 'currency', 'RON',
                'priceVersion', paid_version, 'snapshot', paid_snapshot)
        ),
        NULL
    );
    IF jsonb_array_length(result->'enrollmentIds') <> 2
        OR (result->>'requiresPaymentIntent')::BOOLEAN IS DISTINCT FROM TRUE
        OR (SELECT count(*) FROM public.enrollments WHERE kind = 'COMPETITION' AND status = 'ACTIVE') <> 1
        OR (SELECT count(*) FROM public.enrollments WHERE kind = 'COMPETITION' AND status = 'PENDING') <> 1
        OR (SELECT count(*) FROM public.payments WHERE amount = 0 AND status = 'SUCCEEDED' AND paid_at IS NOT NULL) <> 1
        OR (SELECT count(*) FROM public.competition_registrations WHERE gpx_storage_path_snapshot = route_path) <> 2 THEN
        RAISE EXCEPTION 'Atomic mixed-price competition registration failed';
    END IF;

    BEGIN
        PERFORM public.save_competition_registration(
            '44444444-4444-4444-4444-444444444444',
            'dddddddd-dddd-dddd-dddd-dddddddddddd', 'CARD',
            jsonb_build_array(jsonb_build_object(
                'childId', '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                'categoryId', free_category, 'amount', 0, 'currency', 'RON',
                'priceVersion', free_version, 'snapshot', free_snapshot
            )), NULL
        );
        RAISE EXCEPTION 'Duplicate active registration should fail';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        UPDATE public.competitions
        SET club_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
        WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
        RAISE EXCEPTION 'Competition owner change should fail after registration';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END;
$$;

\i /tmp/competition-adult-registrations.sql

SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', TRUE);
SELECT set_config('request.jwt.claim.user_role', 'CLUB', TRUE);
SELECT set_config('request.jwt.claim.club', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', TRUE);
SET ROLE authenticated;

DO $$
DECLARE
    removed INTEGER;
BEGIN
    DELETE FROM storage.objects
    WHERE name = 'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/ffffffff-ffff-ffff-ffff-ffffffffffff.gpx';
    GET DIAGNOSTICS removed = ROW_COUNT;
    IF removed <> 0 THEN
        RAISE EXCEPTION 'Registered GPX could be removed';
    END IF;

    BEGIN
        DELETE FROM public.competition_routes
        WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
        RAISE EXCEPTION 'Route with registrations should not be removable';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
END;
$$;

RESET ROLE;
SET ROLE authenticated;
DO $$
BEGIN
    IF (SELECT count(*) FROM public.get_competition_cash_payments(
        'dddddddd-dddd-dddd-dddd-dddddddddddd'
    ) WHERE participant_name = 'Club Organizator'
        AND amount = 6000 AND status = 'PENDING') <> 1 THEN
        RAISE EXCEPTION 'Adult cash payment is missing from organizer list';
    END IF;
END;
$$;
RESET ROLE;
UPDATE public.competitions
SET start_at = now() - INTERVAL '2 days',
    end_at = now() - INTERVAL '1 day',
    registration_deadline_at = now() - INTERVAL '3 days'
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

DO $$
DECLARE
    paid_registration UUID;
    paid_category UUID;
BEGIN
    SELECT registration.id, registration.category_id
    INTO paid_registration, paid_category
    FROM public.competition_registrations registration
    WHERE registration.accepted_price_bani = 5000;
    BEGIN
        INSERT INTO public.competition_podium_results(
            competition_id, category_id, registration_id, place
        ) VALUES (
            'dddddddd-dddd-dddd-dddd-dddddddddddd', paid_category, paid_registration, 1
        );
        RAISE EXCEPTION 'Pending payer must not be on podium';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', TRUE);
SELECT set_config('request.jwt.claim.user_role', 'COACH', TRUE);
SELECT set_config('request.jwt.claim.club', '', TRUE);
SET ROLE authenticated;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.payments payment
        JOIN public.enrollments enrollment ON enrollment.id = payment.enrollment_id
        WHERE enrollment.adult_profile_id IS DISTINCT FROM '33333333-3333-3333-3333-333333333333'
    ) THEN
        RAISE EXCEPTION 'Accepted coach can read another participant payment billing data';
    END IF;
    IF (SELECT count(*) FROM public.enrollments WHERE kind = 'COMPETITION') <> 5 THEN
        RAISE EXCEPTION 'Accepted coach cannot read competition enrollment status';
    END IF;
    IF (SELECT count(*) FROM public.get_competition_podium_candidates(
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        (SELECT id FROM public.competition_age_categories WHERE age_from = 18)
    ) WHERE participant_name = 'Antrenor Adult') <> 1 THEN
        RAISE EXCEPTION 'Adult is missing from podium candidates';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.get_competition_podium_candidates(
            'dddddddd-dddd-dddd-dddd-dddddddddddd',
            (SELECT id FROM public.competition_age_categories WHERE age_from = 40)
        )
    ) THEN
        RAISE EXCEPTION 'Unpaid adults appeared on podium candidates';
    END IF;
    BEGIN
        PERFORM * FROM public.get_competition_cash_payments(
            'dddddddd-dddd-dddd-dddd-dddddddddddd'
        );
        RAISE EXCEPTION 'Accepted coach can call owner cash payment RPC';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;

INSERT INTO public.competition_podium_results(
    competition_id, category_id, registration_id, place
)
SELECT registration.competition_id, registration.category_id, registration.id, 1
FROM public.competition_registrations registration
WHERE registration.accepted_price_bani = 0;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', TRUE);
SELECT set_config('request.jwt.claim.user_role', 'CLUB', TRUE);
SELECT set_config('request.jwt.claim.club', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', TRUE);
SET ROLE authenticated;

INSERT INTO public.competition_podium_publications(competition_id, category_id)
SELECT competition_id, category_id
FROM public.competition_podium_results;

RESET ROLE;
SET ROLE anon;
DO $$
BEGIN
    IF (SELECT count(*) FROM public.get_published_competition_podium(
        'dddddddd-dddd-dddd-dddd-dddddddddddd'
    ) WHERE participant_name = 'Copil Gratuit' AND place = 1) <> 1 THEN
        RAISE EXCEPTION 'Published winner missing from public RPC';
    END IF;
    IF (SELECT count(*) FROM public.get_published_competition_podium(
        'dddddddd-dddd-dddd-dddd-dddddddddddd'
    ) WHERE participant_name = 'Antrenor Adult' AND place = 1) <> 1 THEN
        RAISE EXCEPTION 'Published adult winner missing from public RPC';
    END IF;
END;
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', TRUE);
SELECT set_config('request.jwt.claim.user_role', 'COACH', TRUE);
SELECT set_config('request.jwt.claim.club', '', TRUE);
SET ROLE authenticated;
UPDATE public.competition_podium_results SET place = 2 WHERE place = 1;

RESET ROLE;
SET ROLE anon;
DO $$
BEGIN
    IF (SELECT count(*) FROM public.get_published_competition_podium(
        'dddddddd-dddd-dddd-dddd-dddddddddddd'
    ) WHERE participant_name = 'Copil Gratuit' AND place = 2) <> 1 THEN
        RAISE EXCEPTION 'Post-publication correction did not become public';
    END IF;
END;
$$;

RESET ROLE;

\i /tmp/competition-deletion-and-erasure.sql

ROLLBACK;
