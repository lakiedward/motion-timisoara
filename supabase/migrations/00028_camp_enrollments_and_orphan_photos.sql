-- Cine vede înscrierile la o tabără.
--
-- `enrollments_select` avea ramuri pentru curs (antrenorul lui și clubul lui) și
-- pentru activitate (antrenorul ei), dar niciuna pentru tabără. Deci nici clubul
-- care organizează tabăra, nici antrenorii care pleacă cu copiii nu puteau afla
-- cine s-a înscris — exact lucrul pe care proprietarul l-a cerut pe 27.08.
--
-- Se adaugă O SINGURĂ ramură. Restul politicii rămâne literă cu literă cum era:
-- e tabela care spune cine la ce copil are acces, nu e locul unde se rescrie din
-- mers ce nu ai venit să schimbi.

/**
 * Poate utilizatorul curent sa vada cine s-a inscris la tabara data?
 *
 * Doua feluri de oameni: cine RASPUNDE de tabara (clubul sau antrenorul care a
 * facut-o) si cine PLEACA cu copiii (antrenorii insotitori). Al doilea grup nu
 * poate modifica tabara — dar trebuie sa stie pe cine ia in primire.
 *
 * SECURITY DEFINER, ca `pot_administra_tabara`: e chemata dintr-o politica, deci
 * are nevoie de adevarul din tabele, nu de ce vede apelantul.
 */
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
              AND cp.user_id = (SELECT auth.uid())
        )
$$;

COMMENT ON FUNCTION public.pot_vedea_inscrierile_taberei(UUID) IS
    'Proprietarul taberei SAU un antrenor insotitor. Insotitorii vad lista, dar nu pot modifica tabara.';

GRANT EXECUTE ON FUNCTION public.pot_vedea_inscrierile_taberei(UUID) TO authenticated;

DROP POLICY IF EXISTS "enrollments_select" ON public.enrollments;
CREATE POLICY "enrollments_select" ON public.enrollments
    FOR SELECT TO authenticated
    USING (
        -- parintele, pentru copiii lui  (neschimbat)
        child_id IN (SELECT my_child_ids())
        -- antrenorul cursului  (neschimbat)
        OR (
            kind = 'COURSE'
            AND entity_id IN (SELECT id FROM public.courses WHERE coach_id = (SELECT auth.uid()))
        )
        -- antrenorul activitatii  (neschimbat)
        OR (
            kind = 'ACTIVITY'
            AND entity_id IN (SELECT id FROM public.activities WHERE coach_id = (SELECT auth.uid()))
        )
        -- clubul care detine cursul  (neschimbat)
        OR (
            kind = 'COURSE'
            AND entity_id IN (
                SELECT c.id FROM public.courses c
                JOIN public.clubs cl ON c.club_id = cl.id
                WHERE cl.owner_user_id = (SELECT auth.uid())
            )
        )
        -- NOU: tabara — proprietarul ei sau un antrenor insotitor
        OR (kind = 'CAMP' AND public.pot_vedea_inscrierile_taberei(entity_id))
        OR (SELECT get_my_role()) = 'ADMIN'
    );
