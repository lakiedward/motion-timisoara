-- Un curs închis nu-și mai pierde numele din istoricul copilului.
--
-- Bug #983, descoperit pe 26.08 în sesiunea secțiunii #707 și confirmat prin
-- impersonare: `courses_select` lasă părintele să vadă doar cursurile `active`.
-- Când clubul închide un curs, join-ul `attendance → course_occurrences →
-- courses` întoarce `course: null`, iar ecranul cade pe textul de rezervă
-- „Ședință". Părintele nu mai poate spune unde a fost copilul.
--
-- Efectul e RETROACTIV și TĂCUT: un club care dezactivează un curs șterge,
-- fără să știe, numele acelui curs din istoricul tuturor copiilor care l-au
-- frecventat. Și nu doar de pe ecranul de prezență — de pe orice ecran care
-- citește numele unui curs printr-un join: înscrieri, anunțuri, facturi.
--
-- NU se rezolvă în interfață: textul de rezervă doar ascunde lipsa.
--
-- Lărgimea a fost aleasă de proprietar pe 2026-08-28: orice legătură, orice
-- stare. Istoricul e al părintelui, iar faptul că un club a închis cursul nu
-- schimbă unde a fost copilul. O înscriere anulată intră și ea: părintele
-- trebuie să poată citi ce a plătit cândva.

/**
 * Cursurile de care copiii utilizatorului curent au fost vreodata legati.
 *
 * SECURITY DEFINER fiindca e chemata dintr-o politica pe `courses`: are nevoie
 * de adevarul din `enrollments` si `attendance`, nu de ce vede apelantul —
 * altfel politica s-ar intreba pe ea insasi.
 *
 * Nu filtreaza dupa status: si o inscriere anulata face parte din istoric.
 */
CREATE OR REPLACE FUNCTION public.my_children_course_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT e.entity_id
    FROM public.enrollments e
    WHERE e.kind = 'COURSE'
      AND e.child_id IN (SELECT public.my_child_ids())
    UNION
    SELECT o.course_id
    FROM public.attendance a
    JOIN public.course_occurrences o ON o.id = a.occurrence_id
    WHERE a.child_id IN (SELECT public.my_child_ids())
$$;

COMMENT ON FUNCTION public.my_children_course_ids() IS
    'Cursurile la care copiii mei au inscriere (orice status) sau prezenta. Pentru citirea numelui dupa ce clubul inchide cursul.';

GRANT EXECUTE ON FUNCTION public.my_children_course_ids() TO authenticated;

-- Se adaugă O SINGURĂ ramură. `active = true` rămâne pe primul loc și își
-- păstrează cealaltă muncă — ascunde cursurile închise din LISTELE publice —
-- iar celelalte ramuri rămân literă cu literă. E politica pe care stau toate
-- cursurile; nu e locul unde se rescrie din mers ce n-ai venit să schimbi.
DROP POLICY IF EXISTS "courses_select" ON public.courses;
CREATE POLICY "courses_select" ON public.courses
    FOR SELECT TO anon, authenticated
    USING (
        -- listele publice  (neschimbat)
        active = true
        -- antrenorul cursului  (neschimbat)
        OR coach_id = (SELECT auth.uid())
        -- clubul care îl deține  (neschimbat)
        OR club_id IN (SELECT my_club_ids())
        -- NOU: părintele, pentru cursurile din istoricul copiilor lui
        OR id IN (SELECT my_children_course_ids())
        OR (SELECT get_my_role()) = 'ADMIN'
    );
