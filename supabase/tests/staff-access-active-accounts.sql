\set ON_ERROR_STOP on
BEGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE public.profiles(id UUID PRIMARY KEY, role TEXT NOT NULL, name TEXT NOT NULL DEFAULT 'Adult',
    enabled BOOLEAN NOT NULL DEFAULT true, deleted_at TIMESTAMPTZ);
CREATE TABLE public.clubs(id UUID PRIMARY KEY, owner_user_id UUID, stripe_account_id TEXT);
CREATE TABLE public.coach_profiles(id UUID PRIMARY KEY, user_id UUID NOT NULL, stripe_account_id TEXT);
CREATE TABLE public.courses(id UUID PRIMARY KEY, coach_id UUID, club_id UUID, name TEXT NOT NULL DEFAULT 'Curs');
CREATE TABLE public.activities(id UUID PRIMARY KEY, coach_id UUID, club_id UUID, name TEXT NOT NULL DEFAULT 'Activitate');
CREATE TABLE public.camps(id UUID PRIMARY KEY, club_id UUID, coach_id UUID, title TEXT NOT NULL DEFAULT 'Tabără');
CREATE TABLE public.competitions(id UUID PRIMARY KEY, club_id UUID, coach_id UUID, end_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE public.competition_coaches(competition_id UUID NOT NULL REFERENCES public.competitions(id),
    coach_profile_id UUID NOT NULL REFERENCES public.coach_profiles(id),
    status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
    responded_at TIMESTAMPTZ,
    PRIMARY KEY (competition_id, coach_profile_id));
CREATE TABLE public.course_occurrences(id UUID PRIMARY KEY, course_id UUID NOT NULL REFERENCES public.courses(id));
CREATE TABLE public.children(id UUID PRIMARY KEY, parent_id UUID NOT NULL, name TEXT NOT NULL, allergies TEXT);
CREATE TABLE public.enrollments(id UUID PRIMARY KEY, kind TEXT NOT NULL, entity_id UUID NOT NULL,
    child_id UUID REFERENCES public.children(id), adult_profile_id UUID REFERENCES public.profiles(id),
    status TEXT NOT NULL);
CREATE TABLE public.attendance(id UUID PRIMARY KEY, occurrence_id UUID NOT NULL REFERENCES public.course_occurrences(id),
    child_id UUID NOT NULL REFERENCES public.children(id));
CREATE TABLE public.activity_attendance(id UUID PRIMARY KEY, activity_id UUID NOT NULL REFERENCES public.activities(id),
    child_id UUID NOT NULL REFERENCES public.children(id));
CREATE TABLE public.competition_registrations(id UUID PRIMARY KEY, competition_id UUID NOT NULL REFERENCES public.competitions(id),
    enrollment_id UUID NOT NULL REFERENCES public.enrollments(id));
CREATE TABLE public.payments(id UUID PRIMARY KEY, enrollment_id UUID NOT NULL REFERENCES public.enrollments(id),
    method TEXT NOT NULL, status TEXT NOT NULL, amount BIGINT NOT NULL, currency TEXT NOT NULL DEFAULT 'RON',
    pricing_snapshot JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), paid_at TIMESTAMPTZ,
    platform_fee_amount BIGINT, coach_payout_amount BIGINT, stripe_fee_amount BIGINT, stripe_destination_account TEXT);
CREATE TABLE public.monthly_payments(id UUID PRIMARY KEY, enrollment_id UUID NOT NULL REFERENCES public.enrollments(id));
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE SCHEMA IF NOT EXISTS private;
CREATE FUNCTION private.caller_is_active() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.enabled
          AND p.deleted_at IS NULL
    )
$$;
REVOKE ALL ON FUNCTION private.caller_is_active() FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.get_my_role() RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT role FROM public.profiles
    WHERE id = auth.uid() AND enabled AND deleted_at IS NULL;
$$;
CREATE FUNCTION public.pot_vedea_inscrierile_taberei(p_camp_id UUID) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
    SELECT false
$$;
CREATE FUNCTION public.camp_enrolled_child_ids() RETURNS SETOF UUID LANGUAGE sql STABLE AS $$
    SELECT NULL::UUID WHERE false
$$;
CREATE OR REPLACE FUNCTION public.my_child_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT id FROM public.children WHERE parent_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.my_club_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT id FROM public.clubs WHERE owner_user_id = auth.uid();
$function$
;

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
$function$
;

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
$function$
;

CREATE OR REPLACE FUNCTION public.pot_administra_curs(p_course_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = p_course_id
          AND (
              c.club_id IN (SELECT my_club_ids())
              OR c.coach_id = (SELECT auth.uid())
          )
    ) OR (SELECT get_my_role()) = 'ADMIN'
$function$
;

CREATE OR REPLACE FUNCTION public.pot_administra_activitate(p_activity_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.activities a
        WHERE a.id = p_activity_id
          AND (
              a.club_id IN (SELECT my_club_ids())
              OR a.coach_id = (SELECT auth.uid())
          )
    ) OR (SELECT get_my_role()) = 'ADMIN'
$function$
;

CREATE OR REPLACE FUNCTION public.pot_administra_concurs(p_competition_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.competitions c
        WHERE c.id = p_competition_id
          AND (
              c.club_id IN (SELECT public.my_club_ids())
              OR c.coach_id = (SELECT auth.uid())
          )
    ) OR (SELECT public.get_my_role()) = 'ADMIN'
$function$
;

CREATE OR REPLACE FUNCTION public.can_view_competition_registrations(p_competition_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.competitions c
        WHERE c.id = p_competition_id
          AND (
              public.pot_administra_concurs(c.id)
              OR EXISTS (
                  SELECT 1 FROM public.competition_coaches cc
                  JOIN public.coach_profiles cp ON cp.id = cc.coach_profile_id
                  WHERE cc.competition_id = c.id
                    AND cc.status = 'accepted'
                    AND cp.user_id = (SELECT auth.uid())
              )
          )
    )
$function$
;

CREATE OR REPLACE FUNCTION public.respond_to_competition_invitation(p_competition_id uuid, p_accept boolean)
 RETURNS competition_coaches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    invitation public.competition_coaches;
BEGIN
    IF (SELECT auth.uid()) IS NULL OR p_accept IS NULL THEN
        RAISE EXCEPTION 'Invitatia necesita un antrenor autentificat si un raspuns'
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.competition_coaches AS cc
    SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
        responded_at = now()
    WHERE cc.competition_id = p_competition_id
      AND cc.status = 'invited'
      AND cc.coach_profile_id IN (
          SELECT cp.id FROM public.coach_profiles AS cp
          WHERE cp.user_id = (SELECT auth.uid())
      )
    RETURNING * INTO invitation;

    IF invitation IS NULL THEN
        RAISE EXCEPTION 'Nu exista o invitatie activa pentru acest concurs'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN invitation;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_cash_payments()
 RETURNS TABLE(payment_id uuid, enrollment_id uuid, kind text, entity_id uuid, offer_title text, participant_name text, is_adult boolean, sessions integer, amount bigint, currency text, status text, created_at timestamp with time zone, paid_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_role TEXT;
BEGIN
    SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = v_uid;
    IF v_uid IS NULL OR v_role IS NULL OR v_role NOT IN ('COACH', 'CLUB', 'ADMIN') THEN
        RAISE EXCEPTION 'Nu ai acces la plățile cash'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    WITH offers AS (
        SELECT 'COURSE'::TEXT AS kind, c.id, c.name AS title, c.coach_id, c.club_id
        FROM public.courses c
        UNION ALL
        SELECT 'ACTIVITY', a.id, a.name, a.coach_id, a.club_id
        FROM public.activities a
        UNION ALL
        SELECT 'CAMP', t.id, t.title, t.coach_id, t.club_id
        FROM public.camps t
    )
    SELECT payment.id, enrollment.id, enrollment.kind, enrollment.entity_id,
        offer.title, COALESCE(child.name, adult.name), enrollment.child_id IS NULL,
        CASE WHEN enrollment.kind = 'COURSE'
            THEN (payment.pricing_snapshot->>'quantity')::INTEGER END,
        payment.amount, payment.currency, payment.status,
        payment.created_at, payment.paid_at
    FROM public.payments payment
    JOIN public.enrollments enrollment ON enrollment.id = payment.enrollment_id
    JOIN offers offer ON offer.kind = enrollment.kind AND offer.id = enrollment.entity_id
    LEFT JOIN public.clubs club ON club.id = offer.club_id
    LEFT JOIN public.children child ON child.id = enrollment.child_id
    LEFT JOIN public.profiles adult ON adult.id = enrollment.adult_profile_id
    WHERE payment.method = 'CASH'
      AND enrollment.status <> 'CANCELLED'
      AND (payment.status = 'PENDING'
        OR (payment.status = 'SUCCEEDED' AND payment.paid_at > now() - INTERVAL '90 days'))
      AND (v_role = 'ADMIN'
        OR (v_role = 'COACH' AND offer.coach_id = v_uid)
        OR (v_role = 'CLUB' AND club.owner_user_id = v_uid))
    ORDER BY payment.status = 'PENDING' DESC, payment.created_at DESC, payment.id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_card_payments_month()
 RETURNS TABLE(month_start date, collected bigint, stripe_fee bigint, net bigint, payment_count integer, unsettled_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_role TEXT;
    v_account TEXT;
    v_month DATE := date_trunc('month', now() AT TIME ZONE 'Europe/Bucharest')::DATE;
BEGIN
    SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = v_uid;
    IF v_uid IS NULL OR v_role IS NULL OR v_role NOT IN ('COACH', 'CLUB') THEN
        RAISE EXCEPTION 'Nu ai acces la plățile online'
            USING ERRCODE = '42501';
    END IF;

    IF v_role = 'COACH' THEN
        SELECT cp.stripe_account_id INTO v_account
        FROM public.coach_profiles cp WHERE cp.user_id = v_uid;
    ELSE
        SELECT c.stripe_account_id INTO v_account
        FROM public.clubs c WHERE c.owner_user_id = v_uid;
    END IF;

    RETURN QUERY
    SELECT v_month,
        COALESCE(SUM(payment.amount), 0)::BIGINT,
        COALESCE(SUM(payment.platform_fee_amount), 0)::BIGINT,
        COALESCE(SUM(payment.coach_payout_amount), 0)::BIGINT,
        COUNT(payment.id)::INTEGER,
        COUNT(payment.id) FILTER (WHERE payment.stripe_fee_amount IS NULL)::INTEGER
    FROM public.payments payment
    WHERE v_account IS NOT NULL
      AND payment.stripe_destination_account = v_account
      AND payment.method = 'CARD'
      AND payment.status = 'SUCCEEDED'
      AND payment.paid_at >= (v_month::TIMESTAMP AT TIME ZONE 'Europe/Bucharest');
END;
$function$
;

CREATE POLICY activity_attendance_select ON public.activity_attendance FOR SELECT TO authenticated USING (((child_id IN ( SELECT my_child_ids() AS my_child_ids)) OR pot_administra_activitate(activity_id)));

CREATE POLICY attendance_select ON public.attendance FOR SELECT TO authenticated USING (((child_id IN ( SELECT my_child_ids() AS my_child_ids)) OR (occurrence_id IN ( SELECT co.id
   FROM (course_occurrences co
     JOIN courses c ON ((co.course_id = c.id)))
  WHERE (c.coach_id = ( SELECT auth.uid() AS uid)))) OR (occurrence_id IN ( SELECT co.id
   FROM ((course_occurrences co
     JOIN courses c ON ((co.course_id = c.id)))
     JOIN clubs cl ON ((c.club_id = cl.id)))
  WHERE (cl.owner_user_id = ( SELECT auth.uid() AS uid)))) OR (( SELECT get_my_role() AS get_my_role) = 'ADMIN'::text)));

CREATE POLICY children_select ON public.children FOR SELECT TO authenticated USING (((parent_id = ( SELECT auth.uid() AS uid)) OR (id IN ( SELECT coach_enrolled_child_ids() AS coach_enrolled_child_ids)) OR (id IN ( SELECT club_enrolled_child_ids() AS club_enrolled_child_ids)) OR (id IN ( SELECT camp_enrolled_child_ids() AS camp_enrolled_child_ids)) OR (( SELECT get_my_role() AS get_my_role) = 'ADMIN'::text)));

CREATE POLICY competition_registrations_select ON public.competition_registrations FOR SELECT TO authenticated USING (((enrollment_id IN ( SELECT e.id
   FROM enrollments e
  WHERE ((e.child_id IN ( SELECT my_child_ids() AS my_child_ids)) OR (e.adult_profile_id = ( SELECT auth.uid() AS uid))))) OR can_view_competition_registrations(competition_id)));

CREATE POLICY enrollments_competition_staff_select ON public.enrollments FOR SELECT TO authenticated USING (((kind = 'COMPETITION'::text) AND can_view_competition_registrations(entity_id)));

CREATE POLICY enrollments_select ON public.enrollments FOR SELECT TO authenticated USING (((child_id IN ( SELECT my_child_ids() AS my_child_ids)) OR (adult_profile_id = ( SELECT auth.uid() AS uid)) OR ((kind = 'COURSE'::text) AND (entity_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.coach_id = ( SELECT auth.uid() AS uid))))) OR ((kind = 'ACTIVITY'::text) AND (entity_id IN ( SELECT activities.id
   FROM activities
  WHERE (activities.coach_id = ( SELECT auth.uid() AS uid))))) OR ((kind = 'COURSE'::text) AND (entity_id IN ( SELECT c.id
   FROM (courses c
     JOIN clubs cl ON ((c.club_id = cl.id)))
  WHERE (cl.owner_user_id = ( SELECT auth.uid() AS uid))))) OR ((kind = 'CAMP'::text) AND pot_vedea_inscrierile_taberei(entity_id)) OR (( SELECT get_my_role() AS get_my_role) = 'ADMIN'::text)));

CREATE POLICY monthly_payments_select ON public.monthly_payments FOR SELECT TO authenticated USING (((enrollment_id IN ( SELECT e.id
   FROM (enrollments e
     JOIN children c ON ((e.child_id = c.id)))
  WHERE (c.parent_id = ( SELECT auth.uid() AS uid)))) OR (enrollment_id IN ( SELECT e.id
   FROM enrollments e
  WHERE (((e.kind = 'COURSE'::text) AND (e.entity_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.coach_id = ( SELECT auth.uid() AS uid))))) OR ((e.kind = 'ACTIVITY'::text) AND (e.entity_id IN ( SELECT activities.id
           FROM activities
          WHERE (activities.coach_id = ( SELECT auth.uid() AS uid)))))))) OR (( SELECT get_my_role() AS get_my_role) = 'ADMIN'::text)));

ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

CREATE FUNCTION public.test_uuid(v INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-0000-0000-' || lpad(v::TEXT, 12, '0'))::UUID
$$;
INSERT INTO public.profiles(id, role, enabled, deleted_at) VALUES
    (public.test_uuid(1), 'ADMIN', true, NULL), (public.test_uuid(11), 'ADMIN', false, NULL),
    (public.test_uuid(2), 'CLUB', true, NULL), (public.test_uuid(12), 'CLUB', false, NULL),
    (public.test_uuid(3), 'COACH', true, NULL), (public.test_uuid(13), 'COACH', false, NULL),
    (public.test_uuid(23), 'COACH', true, now()),
    (public.test_uuid(4), 'COACH', true, NULL), (public.test_uuid(14), 'COACH', false, NULL),
    (public.test_uuid(5), 'COACH', true, NULL), (public.test_uuid(15), 'COACH', false, NULL),
    (public.test_uuid(8), 'PARENT', true, NULL), (public.test_uuid(18), 'PARENT', false, NULL);
INSERT INTO public.clubs(id, owner_user_id, stripe_account_id) VALUES
    (public.test_uuid(100), public.test_uuid(2), 'acct_club_100'),
    (public.test_uuid(101), public.test_uuid(12), 'acct_club_101');
INSERT INTO public.coach_profiles(id, user_id, stripe_account_id) VALUES
    (public.test_uuid(503), public.test_uuid(3), 'acct_3'), (public.test_uuid(513), public.test_uuid(13), 'acct_13'),
    (public.test_uuid(504), public.test_uuid(4), NULL), (public.test_uuid(514), public.test_uuid(14), NULL),
    (public.test_uuid(505), public.test_uuid(5), NULL), (public.test_uuid(515), public.test_uuid(15), NULL);
INSERT INTO public.courses(id, coach_id, club_id) VALUES
    (public.test_uuid(200), public.test_uuid(3), NULL), (public.test_uuid(201), public.test_uuid(13), NULL),
    (public.test_uuid(202), public.test_uuid(23), NULL),
    (public.test_uuid(210), NULL, public.test_uuid(100)), (public.test_uuid(211), NULL, public.test_uuid(101));
INSERT INTO public.activities(id, coach_id, club_id) VALUES
    (public.test_uuid(300), public.test_uuid(3), NULL), (public.test_uuid(301), public.test_uuid(13), NULL),
    (public.test_uuid(310), NULL, public.test_uuid(100)), (public.test_uuid(311), NULL, public.test_uuid(101));
INSERT INTO public.competitions(id, club_id, coach_id) VALUES
    (public.test_uuid(400), NULL, public.test_uuid(3)), (public.test_uuid(401), NULL, public.test_uuid(13)),
    (public.test_uuid(410), public.test_uuid(100), NULL), (public.test_uuid(411), public.test_uuid(101), NULL);
INSERT INTO public.competition_coaches(competition_id, coach_profile_id, status) VALUES
    (public.test_uuid(400), public.test_uuid(504), 'accepted'),
    (public.test_uuid(400), public.test_uuid(514), 'accepted'),
    (public.test_uuid(400), public.test_uuid(505), 'invited'),
    (public.test_uuid(400), public.test_uuid(515), 'invited');
INSERT INTO public.children(id, parent_id, name)
SELECT public.test_uuid(v), public.test_uuid(8), 'Copil ' || v
FROM unnest(ARRAY[700, 701, 702, 710, 711, 720, 721, 730, 731, 740, 741, 750, 751]) AS v;
INSERT INTO public.children(id, parent_id, name) VALUES (public.test_uuid(790), public.test_uuid(18), 'Copilul părintelui dezactivat');
INSERT INTO public.enrollments(id, kind, entity_id, child_id, status)
SELECT public.test_uuid(child + 100), kind, public.test_uuid(entity), public.test_uuid(child), 'ACTIVE'
FROM (VALUES (700, 'COURSE', 200), (701, 'COURSE', 201), (702, 'COURSE', 202), (710, 'COURSE', 210),
    (711, 'COURSE', 211), (720, 'ACTIVITY', 300), (721, 'ACTIVITY', 301), (730, 'ACTIVITY', 310),
    (731, 'ACTIVITY', 311), (740, 'COMPETITION', 400), (741, 'COMPETITION', 401),
    (750, 'COMPETITION', 410), (751, 'COMPETITION', 411), (790, 'COURSE', 200)) AS e(child, kind, entity);
INSERT INTO public.course_occurrences(id, course_id)
SELECT public.test_uuid(course + 700), public.test_uuid(course) FROM unnest(ARRAY[200, 201, 202, 210, 211]) AS course;
INSERT INTO public.attendance(id, occurrence_id, child_id)
SELECT public.test_uuid(child + 300), public.test_uuid(course + 700), public.test_uuid(child)
FROM (VALUES (700, 200), (701, 201), (702, 202), (710, 210), (711, 211), (790, 200)) AS a(child, course);
INSERT INTO public.activity_attendance(id, activity_id, child_id)
SELECT public.test_uuid(child + 400), public.test_uuid(activity), public.test_uuid(child)
FROM (VALUES (720, 300), (721, 301), (730, 310), (731, 311)) AS a(child, activity);
INSERT INTO public.competition_registrations(id, competition_id, enrollment_id)
SELECT public.test_uuid(child + 500), public.test_uuid(competition), public.test_uuid(child + 100)
FROM (VALUES (740, 400), (741, 401), (750, 410), (751, 411)) AS r(child, competition);
INSERT INTO public.payments(id, enrollment_id, method, status, amount)
SELECT public.test_uuid(child + 600), public.test_uuid(child + 100), 'CASH', 'PENDING', 5000
FROM unnest(ARRAY[700, 701, 710, 711, 720, 721, 730, 731]) AS child;
INSERT INTO public.payments(id, enrollment_id, method, status, amount, paid_at, platform_fee_amount,
    coach_payout_amount, stripe_fee_amount, stripe_destination_account) VALUES
    (public.test_uuid(1700), public.test_uuid(800), 'CARD', 'SUCCEEDED', 5000, now(), 100, 4900, 50, 'acct_3'),
    (public.test_uuid(1701), public.test_uuid(801), 'CARD', 'SUCCEEDED', 5000, now(), 100, 4900, 50, 'acct_13');
INSERT INTO public.monthly_payments(id, enrollment_id) VALUES
    (public.test_uuid(1800), public.test_uuid(800)), (public.test_uuid(1801), public.test_uuid(801));

CREATE TEMP TABLE visibility(phase TEXT, actor TEXT, seen JSONB);
GRANT ALL ON visibility TO authenticated;
CREATE FUNCTION pg_temp.rpc_count(p_sql TEXT) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
    v_count INTEGER;
BEGIN
    EXECUTE p_sql INTO v_count;
    RETURN v_count;
EXCEPTION WHEN SQLSTATE '42501' THEN
    RETURN -1;
END
$$;
CREATE FUNCTION pg_temp.observe(p_phase TEXT, p_actor TEXT, p_user INTEGER) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('request.jwt.claim.sub', public.test_uuid(p_user)::TEXT, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO visibility VALUES (p_phase, p_actor, jsonb_build_array(
        (SELECT count(*) FROM public.children),
        (SELECT count(*) FROM public.enrollments),
        (SELECT count(*) FROM public.attendance),
        (SELECT count(*) FROM public.activity_attendance),
        (SELECT count(*) FROM public.competition_registrations),
        (SELECT count(*) FROM public.monthly_payments),
        (SELECT count(*) FROM public.my_club_ids()),
        pg_temp.rpc_count('SELECT count(*) FROM public.get_cash_payments()'),
        pg_temp.rpc_count('SELECT payment_count FROM public.get_card_payments_month()')));
    RESET ROLE;
END
$$;
CREATE FUNCTION pg_temp.answer(p_user INTEGER, p_accept BOOLEAN) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('request.jwt.claim.sub', public.test_uuid(p_user)::TEXT, true);
    SET LOCAL ROLE authenticated;
    BEGIN
        PERFORM public.respond_to_competition_invitation(public.test_uuid(400), p_accept);
        RESET ROLE;
        RETURN 'ok';
    EXCEPTION WHEN SQLSTATE '42501' OR SQLSTATE 'P0001' THEN
        RESET ROLE;
        RETURN 'refused';
    END;
END
$$;

SELECT pg_temp.observe('before', 'disabled club owner', 12);
SELECT pg_temp.observe('before', 'disabled coach owner', 13);
SELECT pg_temp.observe('before', 'deleted coach owner', 23);
SELECT pg_temp.observe('before', 'disabled accepted coach', 14);
SELECT * FROM visibility ORDER BY actor;
DO $$
BEGIN
    IF (SELECT seen FROM visibility WHERE phase = 'before' AND actor = 'disabled club owner')
        <> '[1,2,1,1,1,0,1,2,0]'::JSONB
       OR (SELECT seen FROM visibility WHERE phase = 'before' AND actor = 'disabled coach owner')
        <> '[2,3,1,1,1,1,0,2,1]'::JSONB
       OR (SELECT seen FROM visibility WHERE phase = 'before' AND actor = 'deleted coach owner')
        <> '[1,1,1,0,0,0,0,0,0]'::JSONB
       OR (SELECT seen FROM visibility WHERE phase = 'before' AND actor = 'disabled accepted coach')
        <> '[0,1,0,0,1,0,0,0,0]'::JSONB THEN
        RAISE EXCEPTION 'Testul nu mai reproduce bug-ul #1366 pe sursele de dinainte de 00132.';
    END IF;
    IF pg_temp.answer(15, true) <> 'ok' THEN
        RAISE EXCEPTION 'Testul nu mai reproduce bug-ul #1366: antrenorul dezactivat accepta invitația.';
    END IF;
    UPDATE public.competition_coaches SET status = 'invited', responded_at = NULL
    WHERE competition_id = public.test_uuid(400) AND coach_profile_id = public.test_uuid(515);
END
$$;

\i /tmp/migrations/00132_staff_access_active_accounts.sql

SELECT pg_temp.observe('after', 'admin', 1);
SELECT pg_temp.observe('after', 'disabled admin', 11);
SELECT pg_temp.observe('after', 'club owner', 2);
SELECT pg_temp.observe('after', 'disabled club owner', 12);
SELECT pg_temp.observe('after', 'coach owner', 3);
SELECT pg_temp.observe('after', 'disabled coach owner', 13);
SELECT pg_temp.observe('after', 'deleted coach owner', 23);
SELECT pg_temp.observe('after', 'accepted coach', 4);
SELECT pg_temp.observe('after', 'disabled accepted coach', 14);
SELECT pg_temp.observe('after', 'parent', 8);
SELECT pg_temp.observe('after', 'disabled parent', 18);
SELECT * FROM visibility WHERE phase = 'after' ORDER BY actor;

DO $$
DECLARE
    v_expected JSONB := jsonb_build_object(
        'admin', '[14,14,6,4,4,2,0,8,-1]'::JSONB,
        'club owner', '[1,2,1,1,1,0,1,2,0]'::JSONB,
        'coach owner', '[3,4,2,1,1,1,0,2,1]'::JSONB,
        'accepted coach', '[0,1,0,0,1,0,0,0,0]'::JSONB,
        'parent', '[13,13,5,4,4,2,0,-1,-1]'::JSONB,
        'disabled parent', '[1,1,1,0,0,0,0,-1,-1]'::JSONB,
        'disabled admin', '[0,0,0,0,0,0,0,-1,-1]'::JSONB,
        'disabled club owner', '[0,0,0,0,0,0,0,-1,-1]'::JSONB,
        'disabled coach owner', '[0,0,0,0,0,0,0,-1,-1]'::JSONB,
        'deleted coach owner', '[0,0,0,0,0,0,0,-1,-1]'::JSONB,
        'disabled accepted coach', '[0,0,0,0,0,0,0,-1,-1]'::JSONB);
    v_row RECORD;
BEGIN
    FOR v_row IN SELECT * FROM visibility WHERE phase = 'after' LOOP
        IF v_row.seen IS DISTINCT FROM v_expected->v_row.actor THEN
            RAISE EXCEPTION 'Vizibilitate greșită pentru %: % (așteptat %)', v_row.actor, v_row.seen,
                v_expected->v_row.actor;
        END IF;
    END LOOP;
END
$$;

DO $$
BEGIN
    PERFORM set_config('request.jwt.claim.sub', public.test_uuid(12)::TEXT, true);
    IF public.pot_administra_curs(public.test_uuid(211)) OR public.pot_administra_activitate(public.test_uuid(311))
       OR public.pot_administra_concurs(public.test_uuid(411)) THEN
        RAISE EXCEPTION 'Clubul dezactivat nu mai administrează ofertele lui.';
    END IF;
    PERFORM set_config('request.jwt.claim.sub', public.test_uuid(13)::TEXT, true);
    IF public.pot_administra_curs(public.test_uuid(201)) OR public.pot_administra_activitate(public.test_uuid(301))
       OR public.pot_administra_concurs(public.test_uuid(401))
       OR public.can_view_competition_registrations(public.test_uuid(401)) THEN
        RAISE EXCEPTION 'Antrenorul dezactivat nu mai administrează ofertele lui.';
    END IF;
    PERFORM set_config('request.jwt.claim.sub', public.test_uuid(14)::TEXT, true);
    IF public.can_view_competition_registrations(public.test_uuid(400)) THEN
        RAISE EXCEPTION 'Antrenorul invitat dezactivat nu mai vede înscrierile concursului.';
    END IF;
    PERFORM set_config('request.jwt.claim.sub', public.test_uuid(2)::TEXT, true);
    IF NOT public.pot_administra_curs(public.test_uuid(210)) OR NOT public.pot_administra_activitate(public.test_uuid(310))
       OR NOT public.pot_administra_concurs(public.test_uuid(410)) THEN
        RAISE EXCEPTION 'Clubul activ își administrează în continuare ofertele.';
    END IF;
    PERFORM set_config('request.jwt.claim.sub', public.test_uuid(3)::TEXT, true);
    IF NOT public.pot_administra_curs(public.test_uuid(200)) OR NOT public.pot_administra_activitate(public.test_uuid(300))
       OR NOT public.pot_administra_concurs(public.test_uuid(400)) THEN
        RAISE EXCEPTION 'Antrenorul activ își administrează în continuare ofertele.';
    END IF;
    PERFORM set_config('request.jwt.claim.sub', public.test_uuid(4)::TEXT, true);
    IF NOT public.can_view_competition_registrations(public.test_uuid(400)) THEN
        RAISE EXCEPTION 'Antrenorul acceptat activ vede în continuare înscrierile.';
    END IF;
    PERFORM set_config('request.jwt.claim.sub', public.test_uuid(1)::TEXT, true);
    IF NOT public.pot_administra_curs(public.test_uuid(211)) OR NOT public.pot_administra_concurs(public.test_uuid(411)) THEN
        RAISE EXCEPTION 'Adminul activ administrează în continuare orice ofertă.';
    END IF;
END
$$;

DO $$
BEGIN
    IF pg_temp.answer(15, true) <> 'refused' THEN
        RAISE EXCEPTION 'Antrenorul dezactivat nu mai poate accepta o invitație la concurs.';
    END IF;
    IF (SELECT status FROM public.competition_coaches
        WHERE competition_id = public.test_uuid(400) AND coach_profile_id = public.test_uuid(515)) <> 'invited' THEN
        RAISE EXCEPTION 'Invitația antrenorului dezactivat trebuia să rămână în așteptare.';
    END IF;
    IF pg_temp.answer(5, true) <> 'ok' THEN
        RAISE EXCEPTION 'Antrenorul activ invitat poate accepta în continuare.';
    END IF;
END
$$;

DO $$
DECLARE
    v_name TEXT;
BEGIN
    FOR v_name IN SELECT unnest(ARRAY['my_club_ids', 'coach_enrolled_child_ids', 'club_enrolled_child_ids',
        'pot_administra_curs', 'pot_administra_activitate', 'pot_administra_concurs',
        'can_view_competition_registrations', 'respond_to_competition_invitation',
        'get_cash_payments', 'get_card_payments_month']) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = v_name AND p.prosecdef
              AND p.proconfig IS NOT NULL
        ) THEN
            RAISE EXCEPTION '% trebuie să rămână SECURITY DEFINER cu search_path fixat.', v_name;
        END IF;
    END LOOP;
END
$$;

DO $$
BEGIN
    BEGIN
        EXECUTE pg_read_file('/tmp/migrations/00132_staff_access_active_accounts.sql');
        RAISE EXCEPTION 'guard-missed';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM = 'guard-missed' THEN
            RAISE EXCEPTION 'Migrația 00132 trebuie să refuze o funcție schimbată de altă migrație.';
        END IF;
    END;
END
$$;

ROLLBACK;
\echo 'staff access for active accounts: ok'
