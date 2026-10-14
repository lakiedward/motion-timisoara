-- ============================================================
-- Lista de cluburi a administratorului, cu emailul brut.
--
-- Pregătire pentru 00094: după #1186 anonimul nu mai citește `clubs.email`,
-- dar orice cont logat (părinte, antrenor, alt club) încă îl citește prin
-- grantul pe coloane din 00035. Singura citire legitimă din aplicație în
-- afara proprietarului (care folosește `my_club()`) este lista de cluburi
-- din /admin. Ea trece acum printr-o funcție SECURITY DEFINER cu poarta pe
-- rol, după modelul `admin_users()` din 00036.
--
-- Se aplică înaintea merge-ului, ca frontendul nou să găsească funcția;
-- 00094 vine după ce frontendul e live.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_clubs()
RETURNS TABLE (
    id uuid,
    name text,
    city text,
    email text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF (SELECT public.get_my_role()) IS DISTINCT FROM 'ADMIN' THEN
        RAISE EXCEPTION 'Doar administratorii pot citi lista de cluburi'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
        SELECT c.id, c.name, c.city, c.email
        FROM public.clubs c
        ORDER BY c.name ASC, c.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_clubs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_clubs() TO authenticated;

NOTIFY pgrst, 'reload schema';
