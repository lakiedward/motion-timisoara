-- Feature TT #696: the coach or club of a course defines up to 4 session
-- packages (number of sessions + total price in the course currency, minor
-- units like courses.price_per_session). Anyone who can read the course can
-- read its packages. Clients cannot write the table directly: the course
-- owner (pot_administra_curs: course coach, club owner or admin, active
-- account) replaces the whole list through save_course_packages, in one
-- transaction, after locking the course row (NO KEY UPDATE, so enrollment
-- foreign keys are not blocked). courses.package_options stays untouched (legacy session
-- counts read by the current checkout).
--
-- validity already holds the two owner-approved kinds (NONE = no expiry,
-- CALENDAR_MONTH = expires at the end of the calendar month) so #697/#698
-- do not need to reshape the table; until #698 ships the monthly expiry,
-- save_course_packages refuses CALENDAR_MONTH.

CREATE TABLE public.course_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    position SMALLINT NOT NULL CHECK (position BETWEEN 0 AND 3),
    sessions INTEGER NOT NULL CHECK (sessions BETWEEN 1 AND 100),
    price BIGINT NOT NULL CHECK (price > 0 AND price <= 10000000),
    validity TEXT NOT NULL DEFAULT 'NONE' CHECK (validity IN ('NONE', 'CALENDAR_MONTH')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT course_packages_position_key UNIQUE (course_id, position) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT course_packages_offer_key UNIQUE (course_id, sessions, validity) DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE public.course_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY course_packages_select ON public.course_packages
    FOR SELECT TO anon, authenticated
    USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_packages.course_id));

REVOKE ALL ON public.course_packages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.course_packages TO anon, authenticated;
GRANT ALL ON public.course_packages TO service_role;

CREATE OR REPLACE FUNCTION public.save_course_packages(p_course_id uuid, p_packages jsonb)
RETURNS SETOF public.course_packages
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM 1 FROM public.courses c WHERE c.id = p_course_id FOR NO KEY UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cursul nu există' USING ERRCODE = 'P0002';
    END IF;

    IF NOT COALESCE((SELECT public.pot_administra_curs(p_course_id)), false) THEN
        RAISE EXCEPTION 'Doar cursul propriu' USING ERRCODE = '42501';
    END IF;

    IF p_packages IS NULL OR jsonb_typeof(p_packages) <> 'array' THEN
        RAISE EXCEPTION 'Lista de pachete lipsește' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_packages) > 4 THEN
        RAISE EXCEPTION 'Cel mult 4 pachete' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        WITH i AS (SELECT NULLIF(e.value->>'id', '')::uuid AS id,
                   (e.ordinality - 1)::smallint AS position,
                   (e.value->>'sessions')::integer AS sessions,
                   (e.value->>'price')::bigint AS price,
                   COALESCE(NULLIF(e.value->>'validity', ''), 'NONE') AS validity
            FROM jsonb_array_elements(p_packages) WITH ORDINALITY AS e(value, ordinality))
        SELECT 1 FROM i WHERE i.validity = 'CALENDAR_MONTH'
    ) THEN
        RAISE EXCEPTION 'Pachetele lunare nu sunt încă disponibile' USING ERRCODE = '0A000';
    END IF;

    IF EXISTS (
        WITH i AS (SELECT NULLIF(e.value->>'id', '')::uuid AS id,
                   (e.ordinality - 1)::smallint AS position,
                   (e.value->>'sessions')::integer AS sessions,
                   (e.value->>'price')::bigint AS price,
                   COALESCE(NULLIF(e.value->>'validity', ''), 'NONE') AS validity
            FROM jsonb_array_elements(p_packages) WITH ORDINALITY AS e(value, ordinality))
        SELECT 1 FROM i
        WHERE i.id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.course_packages p
              WHERE p.id = i.id AND p.course_id = p_course_id
          )
    ) OR (
        WITH i AS (SELECT NULLIF(e.value->>'id', '')::uuid AS id,
                   (e.ordinality - 1)::smallint AS position,
                   (e.value->>'sessions')::integer AS sessions,
                   (e.value->>'price')::bigint AS price,
                   COALESCE(NULLIF(e.value->>'validity', ''), 'NONE') AS validity
            FROM jsonb_array_elements(p_packages) WITH ORDINALITY AS e(value, ordinality))
        SELECT count(*) <> count(DISTINCT i.id) FROM i WHERE i.id IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Pachet necunoscut pentru acest curs' USING ERRCODE = 'P0002';
    END IF;

    DELETE FROM public.course_packages p
    WHERE p.course_id = p_course_id
      AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(p_packages) AS e(value)
          WHERE NULLIF(e.value->>'id', '')::uuid = p.id
      );

    WITH i AS (SELECT NULLIF(e.value->>'id', '')::uuid AS id,
                   (e.ordinality - 1)::smallint AS position,
                   (e.value->>'sessions')::integer AS sessions,
                   (e.value->>'price')::bigint AS price,
                   COALESCE(NULLIF(e.value->>'validity', ''), 'NONE') AS validity
            FROM jsonb_array_elements(p_packages) WITH ORDINALITY AS e(value, ordinality))
    UPDATE public.course_packages p
       SET position = i.position,
           sessions = i.sessions,
           price = i.price,
           validity = i.validity,
           updated_at = now()
      FROM i
     WHERE p.id = i.id
       AND p.course_id = p_course_id
       AND (p.position, p.sessions, p.price, p.validity)
           IS DISTINCT FROM (i.position, i.sessions, i.price, i.validity);

    WITH i AS (SELECT NULLIF(e.value->>'id', '')::uuid AS id,
                   (e.ordinality - 1)::smallint AS position,
                   (e.value->>'sessions')::integer AS sessions,
                   (e.value->>'price')::bigint AS price,
                   COALESCE(NULLIF(e.value->>'validity', ''), 'NONE') AS validity
            FROM jsonb_array_elements(p_packages) WITH ORDINALITY AS e(value, ordinality))
    INSERT INTO public.course_packages (course_id, position, sessions, price, validity)
    SELECT p_course_id, i.position, i.sessions, i.price, i.validity
    FROM i
    WHERE i.id IS NULL;

    SET CONSTRAINTS public.course_packages_position_key, public.course_packages_offer_key IMMEDIATE;

    RETURN QUERY
        SELECT p.* FROM public.course_packages p
        WHERE p.course_id = p_course_id
        ORDER BY p.position;
END;
$$;

REVOKE ALL ON FUNCTION public.save_course_packages(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_course_packages(uuid, jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
