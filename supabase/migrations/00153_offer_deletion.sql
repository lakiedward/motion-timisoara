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

CREATE TABLE private.deleted_camp_ids (
    id UUID PRIMARY KEY,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE private.deleted_camp_ids ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.deleted_camp_ids FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.guard_deleted_camp_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO private.deleted_camp_ids (id) VALUES (OLD.id);
    ELSIF EXISTS (SELECT 1 FROM private.deleted_camp_ids WHERE id = NEW.id) THEN
        RAISE EXCEPTION 'CAMP_DELETED';
    END IF;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_deleted_camp_id() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER camps_guard_deleted_id
    AFTER DELETE OR INSERT ON public.camps FOR EACH ROW
    EXECUTE FUNCTION private.guard_deleted_camp_id();
