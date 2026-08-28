-- Cine duce copiii în tabără le poate citi și fișa.
--
-- Decis cu proprietarul pe 2026-08-27: proprietarul taberei și antrenorii
-- însoțitori văd despre copil exact ce vede azi un antrenor despre copiii de la
-- cursul lui — inclusiv alergiile și contactele de urgență. Pentru o tabără cu
-- cazare, o săptămână departe de părinți, alea sunt chiar motivul pentru care
-- datele există.
--
-- Migrarea 00028 a dat deja acces la ÎNSCRIERI. Dar `children_select` trece
-- prin `coach_enrolled_child_ids` și `club_enrolled_child_ids`, iar amândouă
-- acoperă doar `COURSE` și `ACTIVITY`. Fără ramura de mai jos, lista înscrișilor
-- ar arăta rânduri fără niciun nume: acces la înscriere, dar nu la copil.

/**
 * Copiii inscrisi la taberele pe care le pot vedea.
 *
 * Se sprijina pe `pot_vedea_inscrierile_taberei`, deci acopera de la sine
 * amandoua felurile de oameni: proprietarul si antrenorii insotitori.
 *
 * Numara si `PENDING`, nu doar `ACTIVE`, spre deosebire de surorile ei de la
 * cursuri. Motivul e chiar modelul taberei: `camp_spots_remaining` socoteste un
 * loc drept ocupat si cand plata e in curs, deci un copil PENDING chiar tine un
 * loc — iar organizatorul trebuie sa stie cine e, nu sa vada un rand gol.
 */
CREATE OR REPLACE FUNCTION public.camp_enrolled_child_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT e.child_id
    FROM public.enrollments e
    WHERE e.kind = 'CAMP'
      AND e.status IN ('ACTIVE', 'PENDING')
      AND public.pot_vedea_inscrierile_taberei(e.entity_id)
$$;

COMMENT ON FUNCTION public.camp_enrolled_child_ids() IS
    'Copiii inscrisi la taberele pe care utilizatorul curent le organizeaza sau le insoteste. Include PENDING, fiindca si acela tine un loc.';

GRANT EXECUTE ON FUNCTION public.camp_enrolled_child_ids() TO authenticated;

-- Se adaugă O SINGURĂ ramură. Celelalte rămân literă cu literă cum erau: e
-- politica pe care stau datele copiilor, nu locul unde se rescrie din mers ce
-- n-ai venit să schimbi.
DROP POLICY IF EXISTS "children_select" ON public.children;
CREATE POLICY "children_select" ON public.children
    FOR SELECT TO authenticated
    USING (
        -- părintele, pentru copiii lui  (neschimbat)
        parent_id = (SELECT auth.uid())
        -- antrenorul cursului sau activității  (neschimbat)
        OR id IN (SELECT coach_enrolled_child_ids())
        -- clubul care deține cursul  (neschimbat)
        OR id IN (SELECT club_enrolled_child_ids())
        -- NOU: tabăra — organizatorul ei sau un antrenor însoțitor
        OR id IN (SELECT camp_enrolled_child_ids())
        OR (SELECT get_my_role()) = 'ADMIN'
    );
