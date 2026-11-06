-- Doar antrenorii care au ACCEPTAT tabăra văd cine s-a înscris.
--
-- `pot_vedea_inscrierile_taberei` (00028) a fost scrisă înainte ca invitațiile
-- să aibă status (00030). De atunci un rând în `camp_coaches` poate fi
-- `invited`, `accepted` sau `declined`, dar funcția verifica doar că rândul
-- există. Așa că un antrenor doar invitat, sau unul care a refuzat, citea
-- înscrierile taberei și, prin `camp_enrolled_child_ids` și `children_select`,
-- fișele copiilor: alergii, medicație, telefoane de urgență (bug TT #1363).
--
-- Se schimbă O SINGURĂ condiție: `k.status = 'accepted'`, aceeași regulă pe
-- care o aplică deja `camp_coaches_select` (pagina publică) și
-- `private.is_camp_location_coach` (locația live). `enrollments_select`,
-- `camp_enrolled_child_ids` și `children_select` cheamă funcția, deci se
-- corectează toate fără să fie rescrise.
--
-- Funcția e înlocuită doar dacă în bază e exact sursa din 00028. Dacă altă
-- migrație a schimbat-o între timp, migrația se oprește în loc s-o calce.

DO $$
DECLARE
    v_md5 TEXT;
BEGIN
    SELECT md5(p.prosrc) INTO v_md5
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'pot_vedea_inscrierile_taberei'
      AND pg_get_function_identity_arguments(p.oid) = 'p_camp_id uuid';

    IF v_md5 IS DISTINCT FROM '47bf27b1bc749a02bcd860f890e135ea' THEN
        RAISE EXCEPTION 'pot_vedea_inscrierile_taberei nu mai e sursa din 00028 (md5 %); compară înainte de înlocuire.', v_md5;
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.pot_vedea_inscrierile_taberei(p_camp_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.pot_administra_tabara(p_camp_id)
        OR EXISTS (
            SELECT 1
            FROM public.camp_coaches k
            JOIN public.coach_profiles cp ON cp.id = k.coach_profile_id
            WHERE k.camp_id = p_camp_id
              AND k.status = 'accepted'
              AND cp.user_id = (SELECT auth.uid())
        )
$$;

COMMENT ON FUNCTION public.pot_vedea_inscrierile_taberei(UUID) IS
    'Proprietarul taberei SAU un antrenor insotitor care a acceptat invitatia. Invitatii si cei care au refuzat nu vad nimic.';

GRANT EXECUTE ON FUNCTION public.pot_vedea_inscrierile_taberei(UUID) TO authenticated;
