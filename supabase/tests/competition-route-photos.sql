INSERT INTO public.competition_route_photos(competition_id, route_id, storage_path, display_order)
SELECT
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/gallery/aaaaaaaa-aaaa-aaaa-aaaa-' || lpad(number::TEXT, 12, '0') || '.jpg',
    number - 1
FROM generate_series(1, 12) AS number;

DO $$
BEGIN
    IF (SELECT count(*) FROM public.competition_route_photos) <> 12 THEN
        RAISE EXCEPTION 'The route gallery did not retain twelve ordered photos';
    END IF;

    BEGIN
        INSERT INTO public.competition_route_photos(competition_id, route_id, storage_path)
        VALUES (
            'dddddddd-dddd-dddd-dddd-dddddddddddd',
            'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
            'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/gallery/ffffffff-ffff-ffff-ffff-ffffffffffff.jpg'
        );
        RAISE EXCEPTION 'Thirteenth route photo was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    DELETE FROM public.competition_route_photos
    WHERE storage_path IN (
        'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/gallery/aaaaaaaa-aaaa-aaaa-aaaa-000000000011.jpg',
        'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/gallery/aaaaaaaa-aaaa-aaaa-aaaa-000000000012.jpg'
    );

    BEGIN
        INSERT INTO public.competition_route_photos(competition_id, route_id, storage_path)
        VALUES (
            'dddddddd-dddd-dddd-dddd-dddddddddddd',
            'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
            'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/00000000-0000-0000-0000-000000000000/gallery/ffffffff-ffff-ffff-ffff-ffffffffffff.jpg'
        );
        RAISE EXCEPTION 'Photo path for another route was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO public.competition_route_photos(competition_id, route_id, storage_path)
        VALUES (
            'dddddddd-dddd-dddd-dddd-dddddddddddd',
            'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
            'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/gallery/ffffffff-ffff-ffff-ffff-ffffffffffff.svg'
        );
        RAISE EXCEPTION 'SVG route photo was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO public.competition_route_photos(competition_id, route_id, storage_path)
        VALUES (
            'dddddddd-dddd-dddd-dddd-dddddddddddd',
            '00000000-0000-0000-0000-000000000000',
            'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/00000000-0000-0000-0000-000000000000/gallery/ffffffff-ffff-ffff-ffff-ffffffffffff.jpg'
        );
        RAISE EXCEPTION 'Photo for missing route was accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
END;
$$;

INSERT INTO public.competition_route_photos(competition_id, route_id, storage_path, display_order)
VALUES
    (
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/gallery/aaaaaaaa-aaaa-aaaa-aaaa-000000000011.png',
        10
    ),
    (
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/gallery/aaaaaaaa-aaaa-aaaa-aaaa-000000000012.webp',
        11
    );

UPDATE public.competition_route_photos
SET display_order = display_order + 1
WHERE competition_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

INSERT INTO storage.objects(bucket_id, name) VALUES
    ('competition-photos', 'dddddddd-dddd-dddd-dddd-dddddddddddd/hero/ffffffff-ffff-ffff-ffff-ffffffffffff.jpg'),
    ('competition-photos', 'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/gallery/ffffffff-ffff-ffff-ffff-ffffffffffff.jpg'),
    ('competition-photos', 'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/gallery/aaaaaaaa-aaaa-aaaa-aaaa-000000000011.png'),
    ('competition-photos', 'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/gallery/aaaaaaaa-aaaa-aaaa-aaaa-000000000012.webp');

DO $$
BEGIN
    BEGIN
        INSERT INTO storage.objects(bucket_id, name)
        VALUES ('competition-photos', 'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/00000000-0000-0000-0000-000000000000/gallery/ffffffff-ffff-ffff-ffff-ffffffffffff.jpg');
        RAISE EXCEPTION 'Storage accepted a photo for a missing route';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    BEGIN
        INSERT INTO storage.objects(bucket_id, name)
        VALUES ('competition-photos', 'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/gallery/ffffffff-ffff-ffff-ffff-ffffffffffff.svg');
        RAISE EXCEPTION 'Storage accepted an SVG route photo';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;

DELETE FROM public.competition_route_photos
WHERE storage_path = 'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/gallery/aaaaaaaa-aaaa-aaaa-aaaa-000000000012.webp';

SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', TRUE);
SELECT set_config('request.jwt.claim.club', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', TRUE);

DO $$
BEGIN
    BEGIN
        INSERT INTO public.competition_route_photos(competition_id, route_id, storage_path)
        VALUES (
            'dddddddd-dddd-dddd-dddd-dddddddddddd',
            'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
            'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/gallery/11111111-1111-1111-1111-111111111111.jpg'
        );
        RAISE EXCEPTION 'A foreign organizer added a route photo';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    BEGIN
        INSERT INTO storage.objects(bucket_id, name)
        VALUES ('competition-photos', 'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/gallery/11111111-1111-1111-1111-111111111111.jpg');
        RAISE EXCEPTION 'A foreign organizer uploaded a route photo';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;

RESET ROLE;
SET ROLE anon;
DO $$
BEGIN
    IF (SELECT count(*) FROM public.competition_route_photos) <> 11 THEN
        RAISE EXCEPTION 'Public route gallery is not visible';
    END IF;
END;
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', TRUE);
SELECT set_config('request.jwt.claim.club', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', TRUE);
SET ROLE authenticated;

DELETE FROM public.competition_route_photos
WHERE competition_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

INSERT INTO public.competition_routes(id, competition_id, name, description)
VALUES (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeef',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'Traseu temporar',
    'Descriere temporară'
);
INSERT INTO public.competition_route_photos(competition_id, route_id, storage_path)
VALUES (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeef',
    'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeef/gallery/ffffffff-ffff-ffff-ffff-ffffffffffff.jpg'
);
DELETE FROM public.competition_routes
WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeef';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.competition_route_photos) THEN
        RAISE EXCEPTION 'Route deletion did not cascade through its gallery';
    END IF;
END;
$$;
