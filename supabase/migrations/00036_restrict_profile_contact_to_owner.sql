-- ============================================================
-- Emailul și telefonul nu mai sunt lizibile de orice cont autentificat.
--
-- PROBLEMA, măsurată pe producție 2026-08-31: `profiles_select` e
-- `USING (true)` pentru anon ȘI authenticated, iar `authenticated` avea
-- SELECT la nivel de TABEL. Un părinte fără niciun copil și fără nicio
-- înscriere citea toate cele 19 profiluri: 19 adrese de email — inclusiv
-- cele patru de ADMIN — și 12 numere de telefon. Copiii, înscrierile și
-- plățile erau corect închise; directorul de utilizatori, nu.
--
-- DE CE PE COLOANE, NU PE RÂNDURI (aceeași alegere ca în 00035): numele
-- altor oameni se citește din 13 locuri — carduri de curs, tabere,
-- directorul de antrenori, lotul clubului, listele de admin — și de pe
-- paginile publice, unde anonimul îl vede deja. RLS filtrează rânduri, nu
-- coloane: o politică de rând strânsă ar fi șters numele antrenorilor de
-- peste tot, iar un cont logat ar fi ajuns să vadă mai puțin decât un
-- vizitator. `authenticated` primește deci exact setul lui `anon`.
--
-- Cele trei citiri legitime de contact se întorc prin funcții
-- SECURITY DEFINER, fiecare cu poarta ei. După asta, expunerea nu mai
-- depinde de nimeni care „ține minte" să nu ceară o coloană.
-- ============================================================

-- Revocarea pe coloane nu are efect cât timp rolul are grant pe tabel.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, name, role, avatar_url) ON public.profiles TO authenticated;
-- Rămân în afara grantului: email, phone, enabled, created_at,
-- oauth_provider, oauth_provider_id.

-- --- 1. Propriul profil ------------------------------------------------
-- Pentru loadAppUserResult() și getMyCoachProfile().
CREATE OR REPLACE FUNCTION public.my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT * FROM public.profiles WHERE id = (SELECT auth.uid());
$$;

-- --- 2. Lista de utilizatori pentru administrator ----------------------
-- Ridică excepție în loc să întoarcă gol: o listă goală arată exact ca „nu
-- există utilizatori", iar asta e chiar greșeala pentru care a fost deschis
-- bug-ul #986. Ruta e oricum închisă pe rol în aplicație.
CREATE OR REPLACE FUNCTION public.admin_users()
RETURNS TABLE (
    id uuid,
    name text,
    email text,
    role text,
    enabled boolean,
    created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF (SELECT public.get_my_role()) IS DISTINCT FROM 'ADMIN' THEN
        RAISE EXCEPTION 'Doar administratorii pot citi lista de utilizatori'
            USING ERRCODE = '42501';
    END IF;

    -- Aceeași ordonare ca interogarea pe care o înlocuiește: multe conturi au
    -- aceeași zi de înregistrare, deci sortarea trebuie să fie totală ca
    -- rândurile să nu sară sub cursor între refetch-uri.
    RETURN QUERY
        SELECT p.id, p.name, p.email, p.role, p.enabled, p.created_at
        FROM public.profiles p
        ORDER BY p.created_at DESC, p.name ASC, p.id ASC;
END;
$$;

-- --- 3. Contactele antrenorilor propriului club -----------------------
-- Numele funcției nu poate fi `club_coaches`: așa se cheamă tabelul.
CREATE OR REPLACE FUNCTION public.club_coach_contacts(p_club_id uuid)
RETURNS TABLE (
    coach_profile_id uuid,
    name text,
    email text,
    photo_storage_path text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.id = p_club_id
          AND (c.owner_user_id = (SELECT auth.uid())
               OR (SELECT public.get_my_role()) = 'ADMIN')
    ) THEN
        RAISE EXCEPTION 'Doar clubul propriu' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
        SELECT cp.id, pr.name, pr.email, cp.photo_storage_path
        FROM public.club_coaches cc
        JOIN public.coach_profiles cp ON cp.id = cc.coach_profile_id
        JOIN public.profiles pr ON pr.id = cp.user_id
        WHERE cc.club_id = p_club_id;
END;
$$;

REVOKE ALL ON FUNCTION public.my_profile() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_users() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.club_coach_contacts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_coach_contacts(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
