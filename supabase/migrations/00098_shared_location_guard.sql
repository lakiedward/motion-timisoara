-- A location that another organizer uses (course, activity, camp or
-- competition) can be deactivated, deleted, or have its address or map
-- point changed only by an ADMIN. Owner decision 2026-10-20 09:21:44Z
-- ("Da, protecție acum"), first step towards the shared location catalog
-- (docs/superpowers/specs/2026-10-20-shared-location-catalog-design.md).
--
-- "Another organizer" is judged against the caller: a row is the caller's
-- own when its club belongs to the caller, or when it has no club and the
-- caller is its coach. Every referencing row counts, active or not, because
-- inactive and past offers still show the location to their families.
-- Calls without a user (service role, SQL editor, migrations) are not
-- guarded. The error carries HINT 'shared_location_guard' so the app can
-- show the message instead of a generic failure.

CREATE OR REPLACE FUNCTION public.guard_shared_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_names text;
BEGIN
    IF v_uid IS NULL OR public.get_my_role() = 'ADMIN' THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;

    IF TG_OP = 'UPDATE' AND NOT (
        (OLD.is_active AND NOT NEW.is_active)
        OR NEW.address IS DISTINCT FROM OLD.address
        OR NEW.city IS DISTINCT FROM OLD.city
        OR NEW.county IS DISTINCT FROM OLD.county
        OR NEW.lat IS DISTINCT FROM OLD.lat
        OR NEW.lng IS DISTINCT FROM OLD.lng
    ) THEN
        RETURN NEW;
    END IF;

    SELECT string_agg(DISTINCT coalesce(cl.name, p.name, 'alt organizator'), ', ')
    INTO v_names
    FROM (
        SELECT club_id, coach_id FROM public.courses WHERE location_id = OLD.id
        UNION ALL
        SELECT club_id, coach_id FROM public.activities WHERE location_id = OLD.id
        UNION ALL
        SELECT club_id, coach_id FROM public.camps WHERE location_id = OLD.id
        UNION ALL
        SELECT club_id, coach_id FROM public.competitions WHERE location_id = OLD.id
    ) AS u
    LEFT JOIN public.clubs cl ON cl.id = u.club_id
    LEFT JOIN public.profiles p ON p.id = u.coach_id
    WHERE (u.club_id IS NOT NULL OR u.coach_id IS NOT NULL)
      AND NOT (
          (u.club_id IS NOT NULL AND u.club_id IN (SELECT public.my_club_ids()))
          OR (u.club_id IS NULL AND u.coach_id = v_uid)
      );

    IF v_names IS NULL THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;

    RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = format(
            'Locația „%s” e folosită și de: %s. Doar adminul o poate dezactiva, șterge sau îi poate schimba adresa ori punctul de pe hartă. Scrie-ne din pagina Contact dacă trebuie schimbată.',
            OLD.name,
            v_names
        ),
        HINT = 'shared_location_guard';
END;
$$;

REVOKE ALL ON FUNCTION public.guard_shared_location() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_shared_location() FROM anon, authenticated;

DROP TRIGGER IF EXISTS locations_shared_guard ON public.locations;
CREATE TRIGGER locations_shared_guard
    BEFORE UPDATE OR DELETE ON public.locations
    FOR EACH ROW EXECUTE FUNCTION public.guard_shared_location();
