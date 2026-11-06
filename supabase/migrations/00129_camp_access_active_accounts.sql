-- Conturile dezactivate nu mai citesc taberele, iar refuzul unei invitații e final.
--
-- Bug TT #1364. Dezactivarea din admin schimbă doar `profiles.enabled`; sesiunea
-- rămâne valabilă, iar nicio politică nu verifica `enabled` sau `deleted_at`.
-- Un antrenor, club sau admin dezactivat citea în continuare înscrierile
-- taberelor și, prin `camp_enrolled_child_ids` / `children_select`, fișele
-- copiilor. `private.caller_is_active()` (rol oricare, `enabled`, fără
-- `deleted_at`) e aceeași regulă ca `private.caller_is_active_admin()` din 00124
-- și ca `getActiveUserRole()` din edge functions.
--   - `get_my_role()` întoarce NULL pentru un cont inactiv, deci toate ramurile
--     `= 'ADMIN'` din politici și funcții se închid pentru un admin dezactivat.
--     Verificat pe 2026-11-06: toate folosirile sunt `= 'X'`, `IN (...)` sau
--     `IS DISTINCT FROM 'ADMIN' THEN RAISE`, deci NULL doar restrânge.
--   - `pot_administra_tabara()` și `pot_vedea_inscrierile_taberei()` cer contul
--     activ, deci și organizatorul și antrenorul acceptat pierd accesul.
--
-- Bug TT #1365. `raspunde_invitatie_tabara()` schimba rândul în orice stare, așa
-- că un antrenor care refuzase putea accepta mai târziu fără invitație nouă.
-- Acum răspunde doar la o invitație `invited`, exact ce arată interfața; după un
-- refuz organizatorul scoate antrenorul și îl invită din nou.
--
-- Fiecare funcție e înlocuită doar dacă sursa din bază e cea verificată pe
-- 2026-11-06. Altfel migrația se oprește în loc s-o calce.

DO $$
DECLARE
    v_expected JSONB := jsonb_build_object(
        'get_my_role', '254d68c84543bd7722a11dfc89c2c963',
        'pot_administra_tabara', '79bc481a84a27410cd33eaa92e8d59c9',
        'pot_vedea_inscrierile_taberei', '4294162a6a9a72d0bdc21badd58895eb',
        'raspunde_invitatie_tabara', '47d284ff9374859fd162189501205b39');
    v_name TEXT;
    v_md5 TEXT;
BEGIN
    FOR v_name IN SELECT jsonb_object_keys(v_expected) LOOP
        SELECT md5(p.prosrc) INTO v_md5
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = v_name;

        IF v_md5 IS DISTINCT FROM v_expected->>v_name THEN
            RAISE EXCEPTION '% nu mai e sursa verificată (md5 %); compară înainte de înlocuire.', v_name, v_md5;
        END IF;
    END LOOP;
END
$$;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.caller_is_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.enabled
          AND p.deleted_at IS NULL
    )
$$;
REVOKE ALL ON FUNCTION private.caller_is_active() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT role FROM public.profiles
    WHERE id = auth.uid() AND enabled AND deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.pot_administra_tabara(p_camp_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT (SELECT private.caller_is_active())
        AND (
            EXISTS (
                SELECT 1 FROM public.camps c
                WHERE c.id = p_camp_id
                  AND (
                      c.club_id IN (SELECT my_club_ids())
                      OR c.coach_id = (SELECT auth.uid())
                  )
            ) OR (SELECT get_my_role()) = 'ADMIN'
        )
$$;

CREATE OR REPLACE FUNCTION public.pot_vedea_inscrierile_taberei(p_camp_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT (SELECT private.caller_is_active())
        AND (
            public.pot_administra_tabara(p_camp_id)
            OR EXISTS (
                SELECT 1
                FROM public.camp_coaches k
                JOIN public.coach_profiles cp ON cp.id = k.coach_profile_id
                WHERE k.camp_id = p_camp_id
                  AND k.status = 'accepted'
                  AND cp.user_id = (SELECT auth.uid())
            )
        )
$$;

COMMENT ON FUNCTION public.pot_vedea_inscrierile_taberei(UUID) IS
    'Proprietarul taberei SAU un antrenor insotitor care a acceptat invitatia, doar cu contul activ. Invitatii, cei care au refuzat si conturile dezactivate nu vad nimic.';

CREATE OR REPLACE FUNCTION public.raspunde_invitatie_tabara(p_camp_id UUID, p_accept BOOLEAN)
RETURNS public.camp_coaches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    randul public.camp_coaches;
BEGIN
    UPDATE public.camp_coaches k
    SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
        responded_at = now()
    WHERE k.camp_id = p_camp_id
      AND k.status = 'invited'
      AND k.coach_profile_id IN (
          SELECT id FROM public.coach_profiles WHERE user_id = (SELECT auth.uid())
      )
    RETURNING * INTO randul;

    IF randul IS NULL THEN
        RAISE EXCEPTION 'Nu exista o invitatie in asteptare pentru tine la tabara %', p_camp_id
            USING ERRCODE = 'P0001';
    END IF;

    RETURN randul;
END;
$$;
