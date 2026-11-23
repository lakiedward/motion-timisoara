DO $$
BEGIN
    EXECUTE substring(pg_read_file('/tmp/migrations/00129_camp_access_active_accounts.sql')
        FROM '(CREATE OR REPLACE FUNCTION public\.pot_administra_tabara\(.*?\n\$\$;)');
END;
$$;

CREATE TABLE public.competition_podium_publications (
    competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE
);
CREATE TABLE public.competition_podium_results (
    competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE
);
CREATE TABLE public.course_announcements (
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE
);
CREATE TABLE public.course_ratings (
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY courses_select ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY activities_select ON public.activities FOR SELECT TO authenticated USING (true);
CREATE POLICY camps_select ON public.camps FOR SELECT TO authenticated USING (true);
CREATE POLICY competitions_select ON public.competitions FOR SELECT TO authenticated USING (true);
CREATE POLICY courses_delete ON public.courses FOR DELETE TO authenticated
    USING (club_id IN (SELECT public.my_club_ids()) OR (SELECT public.get_my_role()) = 'ADMIN');
CREATE POLICY activities_delete ON public.activities FOR DELETE TO authenticated
    USING ((SELECT public.get_my_role()) = 'ADMIN');
CREATE POLICY camps_delete ON public.camps FOR DELETE TO authenticated USING (public.pot_administra_tabara(id));
CREATE POLICY competitions_delete ON public.competitions FOR DELETE TO authenticated
    USING (public.pot_administra_concurs(id));
GRANT DELETE ON public.courses, public.activities, public.camps, public.competitions TO authenticated;

\i /tmp/migrations/00153_offer_deletion.sql

CREATE FUNCTION pg_temp.try_offer_delete(offer_table TEXT, actor INT, offer INT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE affected INT;
BEGIN
    PERFORM set_config('request.jwt.claim.sub', public.test_uuid(actor)::TEXT, true);
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', offer_table) USING public.test_uuid(offer);
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected::TEXT;
EXCEPTION WHEN foreign_key_violation THEN
    RETURN SQLERRM;
END;
$$;

DO $$
DECLARE
    offer_table TEXT;
    offer_kind TEXT;
BEGIN
    FOR offer_table, offer_kind IN
        SELECT * FROM (VALUES ('courses','COURSE'), ('activities','ACTIVITY'),
            ('camps','CAMP'), ('competitions','COMPETITION')) AS kinds(table_name, kind)
    LOOP
        EXECUTE format('
            INSERT INTO public.%I (id, coach_id, club_id) VALUES
            (public.test_uuid(801), public.test_uuid(3), NULL),
            (public.test_uuid(802), NULL, public.test_uuid(100)),
            (public.test_uuid(803), public.test_uuid(13), NULL),
            (public.test_uuid(804), public.test_uuid(3), NULL),
            (public.test_uuid(805), NULL, public.test_uuid(100))', offer_table);
        INSERT INTO public.enrollments (id, kind, entity_id, status)
            VALUES (gen_random_uuid(), offer_kind, public.test_uuid(804), 'PENDING'),
                   (gen_random_uuid(), offer_kind, public.test_uuid(805), 'CANCELLED');

        SET LOCAL ROLE authenticated;
        IF pg_temp.try_offer_delete(offer_table, 8, 801) <> '0'
            OR pg_temp.try_offer_delete(offer_table, 4, 801) <> '0'
            OR pg_temp.try_offer_delete(offer_table, 3, 802) <> '0'
            OR pg_temp.try_offer_delete(offer_table, 2, 801) <> '0'
            OR pg_temp.try_offer_delete(offer_table, 13, 803) <> '0'
        THEN
            RAISE EXCEPTION 'Unauthorized deletion on %', offer_table;
        END IF;
        IF pg_temp.try_offer_delete(offer_table, 3, 804) <> 'OFFER_HAS_HISTORY'
            OR pg_temp.try_offer_delete(offer_table, 1, 805) <> 'OFFER_HAS_HISTORY'
        THEN
            RAISE EXCEPTION 'Enrollment history was not protected on %', offer_table;
        END IF;
        IF pg_temp.try_offer_delete(offer_table, 3, 801) <> '1'
            OR pg_temp.try_offer_delete(offer_table, 2, 802) <> '1'
            OR pg_temp.try_offer_delete(offer_table, 1, 803) <> '1'
        THEN
            RAISE EXCEPTION 'Authorized deletion failed on %', offer_table;
        END IF;
        RESET ROLE;
    END LOOP;
END;
$$;

DO $$
BEGIN
    BEGIN
        INSERT INTO public.camps (id) VALUES (public.test_uuid(801)) ON CONFLICT (id) DO NOTHING;
        RAISE EXCEPTION 'Camp ID stayed reusable after deletion' USING ERRCODE = 'XX000';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'CAMP_DELETED' THEN
            RAISE;
        END IF;
    END;
END;
$$;

INSERT INTO public.courses (id) VALUES (public.test_uuid(810));
INSERT INTO public.courses (id) VALUES (public.test_uuid(811)), (public.test_uuid(812));
INSERT INTO public.course_announcements (course_id) VALUES (public.test_uuid(811));
INSERT INTO public.course_ratings (course_id) VALUES (public.test_uuid(812));
INSERT INTO public.activities (id) VALUES (public.test_uuid(810));
INSERT INTO public.competitions (id) VALUES (public.test_uuid(810));
INSERT INTO public.competitions (id) VALUES (public.test_uuid(811));
INSERT INTO public.course_occurrences (id, course_id) VALUES (public.test_uuid(810), public.test_uuid(810));
INSERT INTO public.attendance (id, occurrence_id, child_id)
    VALUES (public.test_uuid(810), public.test_uuid(810), public.test_uuid(700));
INSERT INTO public.activity_attendance (id, activity_id, child_id)
    VALUES (public.test_uuid(810), public.test_uuid(810), public.test_uuid(700));
INSERT INTO public.competition_podium_publications (competition_id) VALUES (public.test_uuid(810));
INSERT INTO public.competition_podium_results (competition_id) VALUES (public.test_uuid(811));

SET LOCAL ROLE authenticated;
DO $$
BEGIN
    IF pg_temp.try_offer_delete('courses', 1, 810) <> 'OFFER_HAS_HISTORY'
        OR pg_temp.try_offer_delete('activities', 1, 810) <> 'OFFER_HAS_HISTORY'
        OR pg_temp.try_offer_delete('competitions', 1, 810) <> 'OFFER_HAS_HISTORY'
        OR pg_temp.try_offer_delete('competitions', 1, 811) <> 'OFFER_HAS_HISTORY'
    THEN
        RAISE EXCEPTION 'Attendance or published results without enrollments were not protected';
    END IF;
    IF pg_temp.try_offer_delete('courses', 1, 811) NOT LIKE '%course_announcements_course_id_fkey%'
        OR pg_temp.try_offer_delete('courses', 1, 812) NOT LIKE '%course_ratings_course_id_fkey%'
    THEN
        RAISE EXCEPTION 'Course announcements or ratings without enrollments were not protected';
    END IF;
END;
$$;
RESET ROLE;
\echo 'offer deletion permissions and history: ok'
