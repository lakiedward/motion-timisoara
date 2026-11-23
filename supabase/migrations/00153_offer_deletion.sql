ALTER POLICY courses_delete ON public.courses
    USING (public.pot_administra_curs(id));

ALTER POLICY activities_delete ON public.activities
    USING (public.pot_administra_activitate(id));

ALTER TABLE public.course_announcements
    DROP CONSTRAINT course_announcements_course_id_fkey,
    ADD CONSTRAINT course_announcements_course_id_fkey
        FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE RESTRICT;
ALTER TABLE public.course_ratings
    DROP CONSTRAINT course_ratings_course_id_fkey,
    ADD CONSTRAINT course_ratings_course_id_fkey
        FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE RESTRICT;

CREATE FUNCTION private.prevent_offer_history_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.enrollments
        WHERE kind = TG_ARGV[0] AND entity_id = OLD.id
    ) OR (CASE TG_ARGV[0]
        WHEN 'COURSE' THEN EXISTS (
            SELECT 1 FROM public.attendance a
            JOIN public.course_occurrences o ON o.id = a.occurrence_id
            WHERE o.course_id = OLD.id
        )
        WHEN 'ACTIVITY' THEN EXISTS (
            SELECT 1 FROM public.activity_attendance WHERE activity_id = OLD.id
        )
        WHEN 'COMPETITION' THEN EXISTS (
            SELECT 1 FROM public.competition_registrations WHERE competition_id = OLD.id
        ) OR EXISTS (
            SELECT 1 FROM public.competition_podium_publications WHERE competition_id = OLD.id
        ) OR EXISTS (
            SELECT 1 FROM public.competition_podium_results WHERE competition_id = OLD.id
        )
        ELSE false
    END) THEN
        RAISE EXCEPTION 'OFFER_HAS_HISTORY' USING ERRCODE = '23503';
    END IF;
    RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_offer_history_deletion() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER courses_delete_history_guard
    BEFORE DELETE ON public.courses FOR EACH ROW
    EXECUTE FUNCTION private.prevent_offer_history_deletion('COURSE');
CREATE TRIGGER activities_delete_history_guard
    BEFORE DELETE ON public.activities FOR EACH ROW
    EXECUTE FUNCTION private.prevent_offer_history_deletion('ACTIVITY');
CREATE TRIGGER camps_delete_history_guard
    BEFORE DELETE ON public.camps FOR EACH ROW
    EXECUTE FUNCTION private.prevent_offer_history_deletion('CAMP');
CREATE TRIGGER competitions_delete_history_guard
    BEFORE DELETE ON public.competitions FOR EACH ROW
    EXECUTE FUNCTION private.prevent_offer_history_deletion('COMPETITION');
