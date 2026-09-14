\set ON_ERROR_STOP on
CREATE SCHEMA IF NOT EXISTS auth;
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
$$;
CREATE TABLE public.profiles (id UUID PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT 'private@example.test', phone TEXT, avatar_url TEXT);
CREATE TABLE public.clubs (id UUID PRIMARY KEY, name TEXT NOT NULL, owner_user_id UUID NOT NULL REFERENCES public.profiles);
CREATE TABLE public.courses (id UUID PRIMARY KEY, name TEXT NOT NULL, club_id UUID REFERENCES public.clubs,
    coach_id UUID NOT NULL REFERENCES public.profiles, active BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE public.activities (id UUID PRIMARY KEY, name TEXT NOT NULL, club_id UUID REFERENCES public.clubs,
    coach_id UUID NOT NULL REFERENCES public.profiles, active BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE public.camps (id UUID PRIMARY KEY, title TEXT NOT NULL, club_id UUID REFERENCES public.clubs, coach_id UUID REFERENCES public.profiles);
CREATE TABLE public.children (id UUID PRIMARY KEY, parent_id UUID NOT NULL REFERENCES public.profiles);
CREATE TABLE public.enrollments (id UUID PRIMARY KEY, kind TEXT NOT NULL, entity_id UUID NOT NULL,
    child_id UUID NOT NULL REFERENCES public.children, status TEXT NOT NULL);
CREATE TABLE public.course_occurrences (id UUID PRIMARY KEY, course_id UUID NOT NULL REFERENCES public.courses);
CREATE TABLE public.attendance (id UUID PRIMARY KEY, occurrence_id UUID REFERENCES public.course_occurrences, child_id UUID REFERENCES public.children);
CREATE TABLE public.coach_profiles (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES public.profiles);
CREATE TABLE public.camp_coaches (camp_id UUID REFERENCES public.camps, coach_profile_id UUID REFERENCES public.coach_profiles);
CREATE TABLE public.course_announcements (id UUID PRIMARY KEY, course_id UUID NOT NULL REFERENCES public.courses,
    author_user_id UUID NOT NULL REFERENCES public.profiles, content TEXT NOT NULL,
    pinned BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE public.club_announcements (id UUID PRIMARY KEY, club_id UUID NOT NULL REFERENCES public.clubs,
    author_user_id UUID NOT NULL REFERENCES public.profiles, title TEXT NOT NULL, content TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true, publish_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    audience_kind TEXT NOT NULL DEFAULT 'CLUB', audience_id UUID,
    CONSTRAINT club_announcements_audience_id_ck CHECK (
        (audience_kind = 'CLUB' AND audience_id IS NULL) OR (audience_kind <> 'CLUB' AND audience_id IS NOT NULL)));
CREATE TABLE public.announcement_attachments (id UUID PRIMARY KEY, announcement_id UUID REFERENCES public.course_announcements ON DELETE CASCADE,
    club_announcement_id UUID REFERENCES public.club_announcements ON DELETE CASCADE,
    type TEXT NOT NULL, url TEXT, storage_path TEXT, expires_at TIMESTAMPTZ,
    CHECK (num_nonnulls(announcement_id, club_announcement_id) = 1));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clubs, public.courses, public.activities,
    public.camps, public.children, public.enrollments, public.course_announcements,
    public.club_announcements, public.announcement_attachments TO authenticated;
REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (id, name, role, avatar_url) ON public.profiles TO authenticated, anon;
SET check_function_bodies = off;
CREATE OR REPLACE FUNCTION public.camp_enrolled_child_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT e.child_id
    FROM public.enrollments e
    WHERE e.kind = 'CAMP'
      AND e.status IN ('ACTIVE', 'PENDING')
      AND public.pot_vedea_inscrierile_taberei(e.entity_id)
$function$;

CREATE OR REPLACE FUNCTION public.club_enrolled_child_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT e.child_id FROM public.enrollments e
    JOIN public.courses c ON e.entity_id = c.id AND e.kind = 'COURSE'
    JOIN public.clubs cl ON c.club_id = cl.id
    WHERE cl.owner_user_id = auth.uid() AND e.status = 'ACTIVE';
$function$;

CREATE OR REPLACE FUNCTION public.coach_enrolled_child_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT e.child_id FROM public.enrollments e
    JOIN public.courses c ON e.entity_id = c.id AND e.kind = 'COURSE'
    WHERE c.coach_id = auth.uid() AND e.status = 'ACTIVE'
  UNION
  SELECT e.child_id FROM public.enrollments e
    JOIN public.activities a ON e.entity_id = a.id AND e.kind = 'ACTIVITY'
    WHERE a.coach_id = auth.uid() AND e.status = 'ACTIVE';
$function$;

CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.my_child_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT id FROM public.children WHERE parent_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.my_children_course_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT e.entity_id
    FROM public.enrollments e
    WHERE e.kind = 'COURSE'
      AND e.child_id IN (SELECT public.my_child_ids())
    UNION
    SELECT o.course_id
    FROM public.attendance a
    JOIN public.course_occurrences o ON o.id = a.occurrence_id
    WHERE a.child_id IN (SELECT public.my_child_ids())
$function$;

CREATE OR REPLACE FUNCTION public.my_club_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT id FROM public.clubs WHERE owner_user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.pot_vedea_inscrierile_taberei(p_camp_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT public.pot_administra_tabara(p_camp_id)
        OR EXISTS (
            SELECT 1
            FROM public.camp_coaches k
            JOIN public.coach_profiles cp ON cp.id = k.coach_profile_id
            WHERE k.camp_id = p_camp_id
              AND cp.user_id = (SELECT auth.uid())
        )
$function$;

CREATE OR REPLACE FUNCTION public.pot_administra_tabara(p_camp_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.camps c
        WHERE c.id = p_camp_id
          AND (
              c.club_id IN (SELECT my_club_ids())
              OR c.coach_id = (SELECT auth.uid())
          )
    ) OR (SELECT get_my_role()) = 'ADMIN'
$function$;
SET check_function_bodies = on;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activities_select" ON public.activities FOR SELECT TO "anon", "authenticated"
    USING (((active = true) OR (coach_id = ( SELECT auth.uid() AS uid)) OR (( SELECT get_my_role() AS get_my_role) = 'ADMIN'::text)));

CREATE POLICY "announcement_attachments_select" ON public.announcement_attachments FOR SELECT TO "authenticated"
    USING (((announcement_id IN ( SELECT course_announcements.id
   FROM course_announcements)) OR (club_announcement_id IN ( SELECT club_announcements.id
   FROM club_announcements))));

CREATE POLICY "camps_select" ON public.camps FOR SELECT TO "anon", "authenticated"
    USING (true);

CREATE POLICY "children_select" ON public.children FOR SELECT TO "authenticated"
    USING (((parent_id = ( SELECT auth.uid() AS uid)) OR (id IN ( SELECT coach_enrolled_child_ids() AS coach_enrolled_child_ids)) OR (id IN ( SELECT club_enrolled_child_ids() AS club_enrolled_child_ids)) OR (id IN ( SELECT camp_enrolled_child_ids() AS camp_enrolled_child_ids)) OR (( SELECT get_my_role() AS get_my_role) = 'ADMIN'::text)));

CREATE POLICY "clubs_select" ON public.clubs FOR SELECT TO "anon", "authenticated"
    USING (true);

CREATE POLICY "course_announcements_delete" ON public.course_announcements FOR DELETE TO "authenticated"
    USING (((course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.coach_id = ( SELECT auth.uid() AS uid)))) OR (( SELECT get_my_role() AS get_my_role) = 'ADMIN'::text)));

CREATE POLICY "course_announcements_insert" ON public.course_announcements FOR INSERT TO "authenticated"
    WITH CHECK (((course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.coach_id = ( SELECT auth.uid() AS uid)))) OR (( SELECT get_my_role() AS get_my_role) = 'ADMIN'::text)));

CREATE POLICY "course_announcements_select" ON public.course_announcements FOR SELECT TO "authenticated"
    USING (((course_id IN ( SELECT e.entity_id
   FROM (enrollments e
     JOIN children c ON ((e.child_id = c.id)))
  WHERE ((c.parent_id = ( SELECT auth.uid() AS uid)) AND (e.kind = 'COURSE'::text) AND (e.status = 'ACTIVE'::text)))) OR (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.coach_id = ( SELECT auth.uid() AS uid)))) OR (( SELECT get_my_role() AS get_my_role) = 'ADMIN'::text)));

CREATE POLICY "course_announcements_update" ON public.course_announcements FOR UPDATE TO "authenticated"
    USING (((course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.coach_id = ( SELECT auth.uid() AS uid)))) OR (( SELECT get_my_role() AS get_my_role) = 'ADMIN'::text)))
    WITH CHECK (((course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.coach_id = ( SELECT auth.uid() AS uid)))) OR (( SELECT get_my_role() AS get_my_role) = 'ADMIN'::text)));

CREATE POLICY "courses_select" ON public.courses FOR SELECT TO "anon", "authenticated"
    USING (((active = true) OR (coach_id = ( SELECT auth.uid() AS uid)) OR (club_id IN ( SELECT my_club_ids() AS my_club_ids)) OR (id IN ( SELECT my_children_course_ids() AS my_children_course_ids)) OR (( SELECT get_my_role() AS get_my_role) = 'ADMIN'::text)));

CREATE POLICY "enrollments_select" ON public.enrollments FOR SELECT TO "authenticated"
    USING (((child_id IN ( SELECT my_child_ids() AS my_child_ids)) OR ((kind = 'COURSE'::text) AND (entity_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.coach_id = ( SELECT auth.uid() AS uid))))) OR ((kind = 'ACTIVITY'::text) AND (entity_id IN ( SELECT activities.id
   FROM activities
  WHERE (activities.coach_id = ( SELECT auth.uid() AS uid))))) OR ((kind = 'COURSE'::text) AND (entity_id IN ( SELECT c.id
   FROM (courses c
     JOIN clubs cl ON ((c.club_id = cl.id)))
  WHERE (cl.owner_user_id = ( SELECT auth.uid() AS uid))))) OR ((kind = 'CAMP'::text) AND pot_vedea_inscrierile_taberei(entity_id)) OR (( SELECT get_my_role() AS get_my_role) = 'ADMIN'::text)));

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO "anon", "authenticated"
    USING (true);

\i /tmp/00019_announcement_views.sql
\i /tmp/00021_club_announcement_audience_ownership.sql
\i /tmp/00055_camp_announcement_audience.sql
\i /tmp/00056_parent_announcement_feed.sql
CREATE TABLE public.test_results (label TEXT NOT NULL);
GRANT SELECT, INSERT ON public.test_results TO authenticated, anon;
CREATE FUNCTION public.test_uuid(n INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-4000-8000-' || lpad(n::TEXT, 12, '0'))::UUID;
$$;
CREATE FUNCTION public.test_assert(value BOOLEAN, label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', label; END IF;
    INSERT INTO public.test_results VALUES (label);
END;
$$;
CREATE FUNCTION public.test_actor(n INTEGER) RETURNS VOID LANGUAGE sql AS $$
    SELECT set_config('request.jwt.claim.sub', public.test_uuid(n)::TEXT, false);
$$;
CREATE FUNCTION public.test_mark_seen(stamp TIMESTAMPTZ) RETURNS VOID LANGUAGE sql AS $$
    SELECT public.mark_parent_announcements_seen(stamp, auth.uid());
$$;
CREATE FUNCTION public.test_feed(course INTEGER DEFAULT NULL, previous JSONB DEFAULT NULL)
RETURNS JSONB LANGUAGE sql AS $$
    SELECT public.get_parent_announcement_feed(
        CASE WHEN course IS NULL THEN NULL ELSE public.test_uuid(course) END,
        (previous->>'asOf')::TIMESTAMPTZ,
        (previous->'nextCursor'->>'pinned')::BOOLEAN,
        (previous->'nextCursor'->>'publishedAt')::TIMESTAMPTZ,
        previous->'nextCursor'->>'source',
        (previous->'nextCursor'->>'id')::UUID,
        p_order_version => previous->'nextCursor'->>'orderVersion'
    );
$$;
