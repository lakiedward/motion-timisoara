-- ============================================================
-- Adminul poate citi telefonul unui singur utilizator, ca să-l editeze.
--
-- 00036 a scos `phone` din grantul pe coloane al lui `authenticated`, deci
-- formularul de editare din /admin/users nu poate citi telefonul curent al
-- unui antrenor sau părinte. Fără valoarea curentă, salvarea formularului
-- ar suprascrie telefonul cu gol.
--
-- Funcția întoarce un singur rând, numai pentru ADMIN, după același model ca
-- `admin_users()`: ridică excepție pentru orice alt rol, ca o eroare să nu
-- arate ca „utilizator inexistent". Scrierea rămâne pe politica existentă
-- `profiles_update` (proprietar sau ADMIN), deci aici nu se schimbă nimic la
-- dreptul de scriere.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_user_detail(p_user_id uuid)
RETURNS TABLE (
    id uuid,
    name text,
    email text,
    role text,
    enabled boolean,
    phone text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF (SELECT public.get_my_role()) IS DISTINCT FROM 'ADMIN' THEN
        RAISE EXCEPTION 'Doar administratorii pot citi datele unui utilizator'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
        SELECT p.id, p.name, p.email, p.role, p.enabled, p.phone
        FROM public.profiles p
        WHERE p.id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_detail(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
