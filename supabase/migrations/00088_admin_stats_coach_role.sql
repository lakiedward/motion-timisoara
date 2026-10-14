-- ============================================================
-- Bug #1095: cardul Antrenori din /admin numără utilizatorii cu rol COACH,
-- exact lista deschisă de /admin/users?role=COACH. Înainte număra
-- coach_profiles, unde există și profilul de antrenor al contului admin.
-- Restul contoarelor rămân identice cu 00080.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS TABLE (
    users bigint,
    coaches bigint,
    clubs bigint,
    courses bigint,
    camps bigint,
    competitions bigint,
    new_users_7d bigint,
    active_invite_codes bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF (SELECT public.get_my_role()) IS DISTINCT FROM 'ADMIN' THEN
        RAISE EXCEPTION 'Doar administratorii pot citi statisticile'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
        SELECT
            (SELECT count(*) FROM public.profiles)::bigint,
            (SELECT count(*) FROM public.profiles WHERE role = 'COACH')::bigint,
            (SELECT count(*) FROM public.clubs)::bigint,
            (SELECT count(*) FROM public.courses)::bigint,
            (SELECT count(*) FROM public.camps)::bigint,
            (SELECT count(*) FROM public.competitions)::bigint,
            (SELECT count(*) FROM public.profiles
              WHERE created_at >= (now() - interval '7 days'))::bigint,
            (SELECT count(*) FROM public.coach_invitation_codes
              WHERE current_uses < max_uses
                AND (expires_at IS NULL OR expires_at > now()))::bigint;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;

NOTIFY pgrst, 'reload schema';
