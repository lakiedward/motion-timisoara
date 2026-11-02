-- ============================================================
-- Adminul vede datele firmei înainte să aprobe un club (funcționalitatea #625).
--
-- /register-club cere acum nume club, CUI, email și telefon. Funcția edge
-- `register-club` verifică CUI-ul la ANAF și salvează denumirea, sediul și
-- numărul de la Registru. Coloanele `company_*` nu au grant SELECT pentru
-- `authenticated` (00035), deci adminul le citește doar prin `admin_clubs()`,
-- care întoarce acum și telefonul și datele firmei.
--
-- `company_name` NULL lângă un `company_cui` completat înseamnă că ANAF nu a
-- răspuns la înscriere: adminul verifică manual înainte să aprobe.
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_clubs();
CREATE FUNCTION public.admin_clubs()
RETURNS TABLE (
    id uuid,
    name text,
    city text,
    email text,
    phone text,
    company_cui text,
    company_name text,
    company_address text,
    company_reg_number text,
    approved_at timestamptz
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
        SELECT c.id, c.name, c.city, c.email, c.phone, c.company_cui,
               c.company_name, c.company_address, c.company_reg_number,
               c.approved_at
        FROM public.clubs c
        ORDER BY c.name ASC, c.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_clubs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_clubs() TO authenticated;

NOTIFY pgrst, 'reload schema';
