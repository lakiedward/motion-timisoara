-- Clubul vede CÂTE înscrieri au activitățile lui, nu cine s-a înscris.
--
-- `enrollments_select` lasă proprietarul clubului să citească înscrierile la
-- CURSURILE clubului, dar nu și pe cele la ACTIVITĂȚILE clubului. Lista
-- „Activitățile clubului” (#3288) are nevoie de numărul de înscrieri active pe
-- rând și de confirmarea la dezactivare, iar formularul de editare (#3290)
-- blochează sportul, locația și prețul când activitatea are înscrieri active
-- sau în așteptare.
--
-- În loc să lărgim politica (rândurile ar expune copilul, adultul și plata),
-- funcția întoarce doar numărătorile, pe activitate, pentru clubul cerut.
-- Verificarea de proprietar e aceeași ca la `club_coach_contacts`: proprietarul
-- clubului sau un administrator; altfel 42501. Politicile existente nu se
-- schimbă.

CREATE OR REPLACE FUNCTION public.club_activity_enrollment_counts(p_club_id UUID)
RETURNS TABLE (activity_id UUID, active_count INTEGER, pending_count INTEGER)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.id = p_club_id
          AND (c.owner_user_id = (SELECT auth.uid()) OR (SELECT public.get_my_role()) = 'ADMIN')
    ) THEN
        RAISE EXCEPTION 'Doar clubul propriu' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
        SELECT a.id,
               (count(*) FILTER (WHERE e.status = 'ACTIVE'))::INTEGER,
               (count(*) FILTER (WHERE e.status = 'PENDING'))::INTEGER
        FROM public.activities a
        JOIN public.enrollments e
          ON e.kind = 'ACTIVITY'
         AND e.entity_id = a.id
         AND e.status IN ('ACTIVE', 'PENDING')
        WHERE a.club_id = p_club_id
        GROUP BY a.id;
END;
$$;

REVOKE ALL ON FUNCTION public.club_activity_enrollment_counts(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.club_activity_enrollment_counts(UUID) TO authenticated;
