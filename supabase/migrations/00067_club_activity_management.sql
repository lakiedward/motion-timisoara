DROP TRIGGER IF EXISTS activities_club_rules_file ON public.activities;
DROP FUNCTION IF EXISTS public.limiteaza_regulament_activitate_club();

DROP POLICY IF EXISTS "activities_insert" ON public.activities;
CREATE POLICY "activities_insert" ON public.activities
    FOR INSERT TO authenticated
    WITH CHECK (
        (
            coach_id = (SELECT auth.uid())
            AND (SELECT public.get_my_role()) IN ('COACH', 'ADMIN')
        )
        OR (
            club_id IN (SELECT public.my_club_ids())
            AND coach_id IN (SELECT public.my_club_coach_user_ids())
        )
        OR (SELECT public.get_my_role()) = 'ADMIN'
    );

DROP POLICY IF EXISTS "activities_update" ON public.activities;
CREATE POLICY "activities_update" ON public.activities
    FOR UPDATE TO authenticated
    USING (
        coach_id = (SELECT auth.uid())
        OR club_id IN (SELECT public.my_club_ids())
        OR (SELECT public.get_my_role()) = 'ADMIN'
    )
    WITH CHECK (
        coach_id = (SELECT auth.uid())
        OR (
            club_id IN (SELECT public.my_club_ids())
            AND coach_id IN (SELECT public.my_club_coach_user_ids())
        )
        OR (SELECT public.get_my_role()) = 'ADMIN'
    );
