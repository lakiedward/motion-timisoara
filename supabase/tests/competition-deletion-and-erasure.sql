UPDATE public.enrollments
SET status = 'CANCELLED'
WHERE child_id = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND kind = 'COMPETITION';

SET ROLE anon;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.get_published_competition_podium(
            'dddddddd-dddd-dddd-dddd-dddddddddddd'
        )
    ) THEN
        RAISE EXCEPTION 'Cancelled registration remained on the public podium';
    END IF;
END;
$$;

RESET ROLE;

DO $$
BEGIN
    BEGIN
        DELETE FROM storage.objects
        WHERE name = 'dddddddd-dddd-dddd-dddd-dddddddddddd/routes/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/ffffffff-ffff-ffff-ffff-ffffffffffff.gpx';
        RAISE EXCEPTION 'Referenced GPX deletion bypassed the guard';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
END;
$$;

DELETE FROM public.children
WHERE id = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.competition_podium_results
        WHERE competition_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
    ) OR EXISTS (
        SELECT 1 FROM public.competition_registrations registration
        JOIN public.enrollments enrollment ON enrollment.id = registration.enrollment_id
        WHERE enrollment.child_id = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    ) THEN
        RAISE EXCEPTION 'Child erasure did not cascade through registration and podium';
    END IF;
END;
$$;

INSERT INTO public.competitions (
    id, title, slug, description, club_id, start_at, end_at,
    registration_deadline_at, location_text
) VALUES (
    '77777777-7777-7777-7777-777777777777', 'Concurs fără înscrieri',
    'concurs-fara-inscrieri', 'Descriere', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    now() + INTERVAL '2 days', now() + INTERVAL '3 days',
    now() + INTERVAL '1 day', 'Timișoara'
);
INSERT INTO public.competition_routes (id, competition_id, name, description)
VALUES (
    '88888888-8888-8888-8888-888888888888',
    '77777777-7777-7777-7777-777777777777', 'Traseu', 'Descriere'
);
INSERT INTO public.competition_age_categories (
    competition_id, route_id, name, age_from, age_to, price_bani
) VALUES (
    '77777777-7777-7777-7777-777777777777',
    '88888888-8888-8888-8888-888888888888', '5–7 ani', 5, 7, 0
);

DO $$
BEGIN
    BEGIN
        UPDATE public.competition_age_categories SET price_bani = 100000000
        WHERE competition_id = '77777777-7777-7777-7777-777777777777';
        RAISE EXCEPTION 'Category price above card charge limit was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    UPDATE public.competition_age_categories SET price_bani = 99999999
    WHERE competition_id = '77777777-7777-7777-7777-777777777777';
    UPDATE public.competition_age_categories SET price_bani = 0
    WHERE competition_id = '77777777-7777-7777-7777-777777777777';
END;
$$;

DO $$
BEGIN
    BEGIN
        DELETE FROM public.competition_routes
        WHERE id = '88888888-8888-8888-8888-888888888888';
        SET CONSTRAINTS competition_age_categories_route_fk IMMEDIATE;
        RAISE EXCEPTION 'Route with category should not be removable';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    IF NOT EXISTS (
        SELECT 1 FROM public.competition_routes
        WHERE id = '88888888-8888-8888-8888-888888888888'
    ) THEN
        RAISE EXCEPTION 'Rejected route deletion was not rolled back';
    END IF;
END;
$$;

DELETE FROM public.competitions
WHERE id = '77777777-7777-7777-7777-777777777777';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.competition_routes
        WHERE competition_id = '77777777-7777-7777-7777-777777777777'
    ) OR EXISTS (
        SELECT 1 FROM public.competition_age_categories
        WHERE competition_id = '77777777-7777-7777-7777-777777777777'
    ) THEN
        RAISE EXCEPTION 'Deleting an unregistered competition left routes or categories';
    END IF;
END;
$$;
