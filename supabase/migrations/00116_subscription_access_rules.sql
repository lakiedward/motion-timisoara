-- Feature #614: server-side access rules for coaches and clubs without an
-- active subscription (spec docs/superpowers/specs/2026-11-02-abonamente-antrenori-cluburi.md,
-- section "What expiry changes").
--
-- Visibility. The marketplace audience (visitors and parents) no longer reads
-- offers, clubs or coach profiles whose owner has no access. The rule lives in
-- the SELECT policies, so every list, map, home count and detail page follows
-- it, and a detail page opened from an old link shows the existing "offer
-- unavailable" state. Exceptions that keep working:
--   * COACH, CLUB and ADMIN accounts read as before; their panels, invitation
--     searches and competition tools depend on reading other organizers.
--   * A parent keeps reading an offer, its club and its coach when the parent
--     or one of their children has an enrollment there (any status), so the
--     account pages, payments and history stay intact.
--   * Owners keep their existing branches (own offers, own club).
-- The test-account filter from 00112/00113 is unchanged.
--
-- New enrollments. A BEFORE INSERT trigger on enrollments refuses a row whose
-- offer has no access, with SQLSTATE 23514 and DETAIL SUBSCRIPTION_INACTIVE.
-- Every new-enrollment path (course, camp, activity, competition; card and
-- cash) inserts through this table, while paying, topping up or attending an
-- existing enrollment never inserts one. The edge functions check the same rule
-- first through enrollment_offer_has_access() so they can answer 409 with the
-- code before any work.
--
-- While subscription_settings.launch_at is NULL, offer_has_access(),
-- subscriber_has_access() and coach_has_access() return true, so nothing
-- changes until the owner launches.

CREATE OR REPLACE FUNCTION private.viewer_reads_all_organizers()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE((SELECT p.role IN ('COACH', 'CLUB', 'ADMIN')
                     FROM public.profiles p WHERE p.id = auth.uid()), false)
$$;
REVOKE ALL ON FUNCTION private.viewer_reads_all_organizers() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.viewer_enrolled_offers()
RETURNS TABLE (kind TEXT, entity_id UUID, club_id UUID, coach_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    WITH mine AS (
        SELECT DISTINCT e.kind, e.entity_id
        FROM public.enrollments e
        LEFT JOIN public.children ch ON ch.id = e.child_id
        WHERE auth.uid() IS NOT NULL
          AND (ch.parent_id = auth.uid() OR e.adult_profile_id = auth.uid())
    )
    SELECT m.kind, m.entity_id, o.club_id, o.coach_id
    FROM mine m
    JOIN LATERAL (
        SELECT c.club_id, c.coach_id FROM public.courses c WHERE m.kind = 'COURSE' AND c.id = m.entity_id
        UNION ALL
        SELECT c.club_id, c.coach_id FROM public.camps c WHERE m.kind = 'CAMP' AND c.id = m.entity_id
        UNION ALL
        SELECT a.club_id, a.coach_id FROM public.activities a WHERE m.kind = 'ACTIVITY' AND a.id = m.entity_id
        UNION ALL
        SELECT c.club_id, c.coach_id FROM public.competitions c WHERE m.kind = 'COMPETITION' AND c.id = m.entity_id
    ) o ON true
$$;
REVOKE ALL ON FUNCTION private.viewer_enrolled_offers() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.offer_listed(p_kind TEXT, p_entity_id UUID, p_club_id UUID, p_coach_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.offer_has_access(p_club_id, p_coach_id)
        OR private.viewer_reads_all_organizers()
        OR EXISTS (
            SELECT 1 FROM private.viewer_enrolled_offers() o
            WHERE o.kind = p_kind AND o.entity_id = p_entity_id
        )
$$;

CREATE OR REPLACE FUNCTION public.club_listed(p_club_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.subscriber_has_access(p_club_id, NULL)
        OR private.viewer_reads_all_organizers()
        OR EXISTS (SELECT 1 FROM private.viewer_enrolled_offers() o WHERE o.club_id = p_club_id)
$$;

CREATE OR REPLACE FUNCTION public.coach_listed(p_coach_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.coach_has_access(p_coach_user_id)
        OR p_coach_user_id = auth.uid()
        OR private.viewer_reads_all_organizers()
        OR EXISTS (SELECT 1 FROM private.viewer_enrolled_offers() o WHERE o.coach_id = p_coach_user_id)
$$;

REVOKE ALL ON FUNCTION public.offer_listed(TEXT, UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.club_listed(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coach_listed(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.offer_listed(TEXT, UUID, UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.club_listed(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.coach_listed(UUID) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS courses_select ON public.courses;
CREATE POLICY courses_select ON public.courses
    FOR SELECT TO anon, authenticated
    USING (
        (active = true AND public.offer_listed('COURSE', id, club_id, coach_id))
        OR coach_id = (SELECT auth.uid())
        OR club_id IN (SELECT public.my_club_ids())
        OR id IN (SELECT public.my_children_course_ids())
        OR (SELECT public.get_my_role()) = 'ADMIN'
    );

DROP POLICY IF EXISTS activities_select ON public.activities;
CREATE POLICY activities_select ON public.activities
    FOR SELECT TO anon, authenticated
    USING (
        (active = true AND public.offer_listed('ACTIVITY', id, club_id, coach_id))
        OR coach_id = (SELECT auth.uid())
        OR club_id IN (SELECT public.my_club_ids())
        OR (SELECT public.get_my_role()) = 'ADMIN'
    );

DROP POLICY IF EXISTS camps_select ON public.camps;
CREATE POLICY camps_select ON public.camps
    FOR SELECT TO anon, authenticated
    USING (public.offer_listed('CAMP', id, club_id, coach_id));

DROP POLICY IF EXISTS competitions_select ON public.competitions;
CREATE POLICY competitions_select ON public.competitions
    FOR SELECT TO anon, authenticated
    USING (public.offer_listed('COMPETITION', id, club_id, coach_id));

DROP POLICY IF EXISTS clubs_select ON public.clubs;
CREATE POLICY clubs_select ON public.clubs
    FOR SELECT TO authenticated
    USING (
        (approved_at IS NOT NULL AND public.club_listed(id))
        OR owner_user_id = (SELECT auth.uid())
        OR (SELECT public.get_my_role()) = 'ADMIN'
    );

DROP POLICY IF EXISTS clubs_select_anon ON public.clubs;
CREATE POLICY clubs_select_anon ON public.clubs
    FOR SELECT TO anon
    USING (approved_at IS NOT NULL AND public.club_listed(id));

DROP POLICY IF EXISTS coach_profiles_select ON public.coach_profiles;
CREATE POLICY coach_profiles_select ON public.coach_profiles
    FOR SELECT TO anon, authenticated
    USING (public.coach_listed(user_id));

CREATE OR REPLACE FUNCTION public.enrollment_offer_has_access(p_kind TEXT, p_entity_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE((
        SELECT public.offer_has_access(o.club_id, o.coach_id)
        FROM (
            SELECT c.club_id, c.coach_id FROM public.courses c WHERE p_kind = 'COURSE' AND c.id = p_entity_id
            UNION ALL
            SELECT c.club_id, c.coach_id FROM public.camps c WHERE p_kind = 'CAMP' AND c.id = p_entity_id
            UNION ALL
            SELECT a.club_id, a.coach_id FROM public.activities a WHERE p_kind = 'ACTIVITY' AND a.id = p_entity_id
            UNION ALL
            SELECT c.club_id, c.coach_id FROM public.competitions c WHERE p_kind = 'COMPETITION' AND c.id = p_entity_id
        ) o
        LIMIT 1
    ), true)
$$;
REVOKE ALL ON FUNCTION public.enrollment_offer_has_access(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enrollment_offer_has_access(TEXT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_enrollment_subscription_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT public.enrollment_offer_has_access(NEW.kind, NEW.entity_id) THEN
        RAISE EXCEPTION 'Această ofertă nu primește înscrieri momentan.'
            USING ERRCODE = '23514', DETAIL = 'SUBSCRIPTION_INACTIVE';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_enrollment_subscription_access() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enforce_enrollment_subscription_access
    BEFORE INSERT ON public.enrollments
    FOR EACH ROW EXECUTE FUNCTION public.enforce_enrollment_subscription_access();
