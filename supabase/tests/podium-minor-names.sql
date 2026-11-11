\set ON_ERROR_STOP on
BEGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE public.profiles(id UUID PRIMARY KEY, name TEXT);
CREATE TABLE public.children(id UUID PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE public.enrollments(id UUID PRIMARY KEY, child_id UUID, adult_profile_id UUID,
    status TEXT NOT NULL);
CREATE TABLE public.competition_registrations(id UUID PRIMARY KEY, enrollment_id UUID NOT NULL,
    competition_id UUID NOT NULL, category_id UUID NOT NULL, age_at_registration INTEGER NOT NULL);
CREATE TABLE public.competition_podium_publications(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL, category_id UUID NOT NULL UNIQUE,
    published_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE public.competition_podium_results(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL, category_id UUID NOT NULL, registration_id UUID NOT NULL,
    place INTEGER NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_podium_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_podium_publications ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.test_uuid(p_n INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-0000-0000-' || lpad(p_n::TEXT, 12, '0'))::UUID
$$;

DO $do$
BEGIN
    EXECUTE 'CREATE FUNCTION public.get_published_competition_podium(p_competition_id UUID)
RETURNS TABLE (category_id UUID, place INTEGER, participant_name TEXT,
    published_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '''' AS $f$'
        || replace($body$
    SELECT result.category_id, result.place, COALESCE(child.name, adult.name),
        publication.published_at, result.updated_at
    FROM public.competition_podium_results result
    JOIN public.competition_podium_publications publication
      ON publication.category_id = result.category_id
     AND publication.competition_id = result.competition_id
    JOIN public.competition_registrations registration
      ON registration.id = result.registration_id
    JOIN public.enrollments enrollment
      ON enrollment.id = registration.enrollment_id
    LEFT JOIN public.children child ON child.id = enrollment.child_id
    LEFT JOIN public.profiles adult ON adult.id = enrollment.adult_profile_id
    WHERE result.competition_id = p_competition_id
      AND enrollment.status = 'ACTIVE'
    ORDER BY result.category_id, result.place
$body$, E'\n', E'\r\n') || '$f$';
END
$do$;
REVOKE ALL ON FUNCTION public.get_published_competition_podium(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_published_competition_podium(UUID) TO anon, authenticated;

INSERT INTO public.profiles VALUES
    (public.test_uuid(1), 'Adult Audit Complet'),
    (public.test_uuid(2), 'Teen Ionescu'),
    (public.test_uuid(3), 'Părinte Ștefănescu');
INSERT INTO public.children VALUES
    (public.test_uuid(10), 'Ana Maria Ionescu'),
    (public.test_uuid(11), E'  Mihai \t Popescu-Radu  '),
    (public.test_uuid(12), 'Ștefan Țurcan'),
    (public.test_uuid(13), 'Luca'),
    (public.test_uuid(14), 'Ioana Major Vlad'),
    (public.test_uuid(15), 'Copil Retras');
INSERT INTO public.enrollments VALUES
    (public.test_uuid(20), public.test_uuid(10), NULL, 'ACTIVE'),
    (public.test_uuid(21), public.test_uuid(11), NULL, 'ACTIVE'),
    (public.test_uuid(22), public.test_uuid(12), NULL, 'ACTIVE'),
    (public.test_uuid(23), public.test_uuid(13), NULL, 'ACTIVE'),
    (public.test_uuid(24), public.test_uuid(14), NULL, 'ACTIVE'),
    (public.test_uuid(25), NULL, public.test_uuid(1), 'ACTIVE'),
    (public.test_uuid(26), NULL, public.test_uuid(2), 'ACTIVE'),
    (public.test_uuid(27), public.test_uuid(15), NULL, 'CANCELLED'),
    (public.test_uuid(28), NULL, public.test_uuid(3), 'ACTIVE');
INSERT INTO public.competition_registrations VALUES
    (public.test_uuid(30), public.test_uuid(20), public.test_uuid(100), public.test_uuid(110), 9),
    (public.test_uuid(31), public.test_uuid(21), public.test_uuid(100), public.test_uuid(110), 10),
    (public.test_uuid(32), public.test_uuid(22), public.test_uuid(100), public.test_uuid(110), 11),
    (public.test_uuid(33), public.test_uuid(23), public.test_uuid(100), public.test_uuid(111), 7),
    (public.test_uuid(34), public.test_uuid(24), public.test_uuid(100), public.test_uuid(111), 18),
    (public.test_uuid(35), public.test_uuid(25), public.test_uuid(100), public.test_uuid(112), 35),
    (public.test_uuid(36), public.test_uuid(26), public.test_uuid(100), public.test_uuid(112), 16),
    (public.test_uuid(37), public.test_uuid(27), public.test_uuid(100), public.test_uuid(111), 8),
    (public.test_uuid(38), public.test_uuid(28), public.test_uuid(100), public.test_uuid(113), 40);
INSERT INTO public.competition_podium_publications(competition_id, category_id) VALUES
    (public.test_uuid(100), public.test_uuid(110)),
    (public.test_uuid(100), public.test_uuid(111)),
    (public.test_uuid(100), public.test_uuid(112));
INSERT INTO public.competition_podium_results(competition_id, category_id, registration_id, place) VALUES
    (public.test_uuid(100), public.test_uuid(110), public.test_uuid(30), 1),
    (public.test_uuid(100), public.test_uuid(110), public.test_uuid(31), 2),
    (public.test_uuid(100), public.test_uuid(110), public.test_uuid(32), 3),
    (public.test_uuid(100), public.test_uuid(111), public.test_uuid(33), 1),
    (public.test_uuid(100), public.test_uuid(111), public.test_uuid(34), 2),
    (public.test_uuid(100), public.test_uuid(111), public.test_uuid(37), 3),
    (public.test_uuid(100), public.test_uuid(112), public.test_uuid(35), 1),
    (public.test_uuid(100), public.test_uuid(112), public.test_uuid(36), 2),
    (public.test_uuid(100), public.test_uuid(113), public.test_uuid(38), 1);

CREATE FUNCTION public.test_podium_names() RETURNS TEXT[] LANGUAGE plpgsql AS $$
DECLARE
    v_names TEXT[];
BEGIN
    SET LOCAL ROLE anon;
    SELECT array_agg(participant_name ORDER BY category_id, place) INTO v_names
    FROM public.get_published_competition_podium(public.test_uuid(100));
    RESET ROLE;
    RETURN v_names;
END;
$$;
GRANT EXECUTE ON FUNCTION public.test_podium_names() TO anon;

DO $$
BEGIN
    IF public.test_podium_names() IS DISTINCT FROM ARRAY[
        'Ana Maria Ionescu', E'  Mihai \t Popescu-Radu  ', 'Ștefan Țurcan',
        'Luca', 'Ioana Major Vlad', 'Adult Audit Complet', 'Teen Ionescu'] THEN
        RAISE EXCEPTION 'Testul nu reproduce numele complete înainte de 00138: %',
            public.test_podium_names();
    END IF;
END $$;

\i /tmp/migrations/00138_podium_minor_names.sql

DO $$
DECLARE
    v_names TEXT[] := public.test_podium_names();
BEGIN
    IF v_names IS DISTINCT FROM ARRAY[
        'Ana Maria I.', 'Mihai P.', 'Ștefan Ț.',
        'Luca', 'Ioana Major V.', 'Adult Audit Complet', 'Teen I.'] THEN
        RAISE EXCEPTION 'Podiumul public după 00138 e greșit: %', v_names;
    END IF;
    IF has_function_privilege('anon', 'public.get_published_competition_podium(uuid)', 'EXECUTE') IS NOT TRUE
       OR has_function_privilege('authenticated', 'public.get_published_competition_podium(uuid)', 'EXECUTE') IS NOT TRUE THEN
        RAISE EXCEPTION 'anon și authenticated trebuie să poată citi în continuare podiumul publicat.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_proc p, aclexplode(p.proacl) acl
        WHERE p.oid = 'public.get_published_competition_podium(uuid)'::regprocedure
          AND acl.grantee = 0
    ) THEN
        RAISE EXCEPTION 'PUBLIC nu trebuie să aibă EXECUTE pe podium.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE oid = 'public.get_published_competition_podium(uuid)'::regprocedure
          AND prosecdef AND proconfig = ARRAY['search_path=""']
    ) THEN
        RAISE EXCEPTION 'Funcția trebuie să rămână SECURITY DEFINER cu search_path gol.';
    END IF;
END $$;

DO $$
BEGIN
    BEGIN
        EXECUTE pg_read_file('/tmp/migrations/00138_podium_minor_names.sql');
        RAISE EXCEPTION 'guard-missed';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE 'get_published_competition_podium nu mai e cea din 00073%' THEN
            RAISE EXCEPTION 'Migrația 00138 trebuie să refuze o funcție schimbată între timp: %', SQLERRM;
        END IF;
    END;
END $$;

SELECT 'podium-minor-names: ok' AS result;
ROLLBACK;
