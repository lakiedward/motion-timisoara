\set ON_ERROR_STOP on
BEGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE public.profiles(id UUID PRIMARY KEY, role TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true, deleted_at TIMESTAMPTZ);
CREATE TABLE public.clubs(id UUID PRIMARY KEY, owner_user_id UUID);
CREATE TABLE public.courses(id UUID PRIMARY KEY, coach_id UUID, club_id UUID);
CREATE TABLE public.activities(id UUID PRIMARY KEY, coach_id UUID);
CREATE TABLE public.competitions(id UUID PRIMARY KEY, coach_id UUID, club_id UUID);
CREATE TABLE public.children(id UUID PRIMARY KEY, parent_id UUID NOT NULL, name TEXT NOT NULL);
CREATE TABLE public.enrollments(id UUID PRIMARY KEY, kind TEXT NOT NULL, entity_id UUID NOT NULL,
    child_id UUID REFERENCES public.children(id), adult_profile_id UUID);
CREATE TABLE public.payments(id UUID PRIMARY KEY, enrollment_id UUID NOT NULL REFERENCES public.enrollments(id),
    amount BIGINT NOT NULL, status TEXT NOT NULL, billing_name TEXT, billing_email TEXT,
    billing_address_line1 TEXT, card_last4 TEXT, client_secret TEXT);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.profiles, public.clubs, public.courses, public.activities, public.competitions,
    public.children, public.enrollments, public.payments TO authenticated;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE FUNCTION public.test_uuid(p_n INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-0000-0000-' || lpad(p_n::TEXT, 12, '0'))::UUID
$$;
CREATE FUNCTION public.my_club_ids() RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT id FROM public.clubs WHERE owner_user_id = auth.uid()
$$;
CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    SELECT role FROM public.profiles
    WHERE id = auth.uid() AND enabled AND deleted_at IS NULL;
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

CREATE POLICY "payments_select" ON public.payments
    FOR SELECT TO authenticated
    USING (
        enrollment_id IN (
            SELECT e.id FROM public.enrollments e
            JOIN public.children c ON e.child_id = c.id
            WHERE c.parent_id = (SELECT auth.uid())
        )
        OR enrollment_id IN (
            SELECT e.id FROM public.enrollments e
            WHERE e.adult_profile_id = (SELECT auth.uid())
        )
        OR enrollment_id IN (
            SELECT e.id FROM public.enrollments e
            WHERE (e.kind = 'COURSE' AND e.entity_id IN (SELECT id FROM public.courses WHERE coach_id = (SELECT auth.uid())))
               OR (e.kind = 'ACTIVITY' AND e.entity_id IN (SELECT id FROM public.activities WHERE coach_id = (SELECT auth.uid())))
        )
        OR enrollment_id IN (
            SELECT e.id FROM public.enrollments e
            WHERE e.kind = 'COURSE' AND e.entity_id IN (
                SELECT c.id FROM public.courses c JOIN public.clubs cl ON c.club_id = cl.id
                WHERE cl.owner_user_id = (SELECT auth.uid())))
        OR (SELECT public.get_my_role()) = 'ADMIN'
    );
CREATE POLICY "payments_insert" ON public.payments
  FOR INSERT TO authenticated WITH CHECK ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY "payments_update" ON public.payments
  FOR UPDATE TO authenticated USING ((select public.get_my_role()) = 'ADMIN')
  WITH CHECK ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY "payments_delete" ON public.payments
  FOR DELETE TO authenticated USING ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY payments_competition_staff_select ON public.payments
    FOR SELECT TO authenticated
    USING (
        enrollment_id IN (
            SELECT e.id FROM public.enrollments e
            WHERE e.kind = 'COMPETITION'
              AND public.pot_administra_concurs(e.entity_id)
        )
    );

INSERT INTO public.profiles(id, role, enabled, deleted_at) VALUES
    (public.test_uuid(1), 'ADMIN', true, NULL),
    (public.test_uuid(2), 'PARENT', true, NULL),
    (public.test_uuid(3), 'COACH', true, NULL),
    (public.test_uuid(4), 'CLUB', true, NULL),
    (public.test_uuid(5), 'COACH', true, NULL),
    (public.test_uuid(6), 'COACH', true, NULL),
    (public.test_uuid(7), 'PARENT', true, NULL),
    (public.test_uuid(8), 'PARENT', true, NULL),
    (public.test_uuid(9), 'ADMIN', false, NULL),
    (public.test_uuid(10), 'CLUB', true, NULL);
INSERT INTO public.clubs VALUES (public.test_uuid(100), public.test_uuid(4)), (public.test_uuid(101), public.test_uuid(10));
INSERT INTO public.courses VALUES (public.test_uuid(200), public.test_uuid(3), public.test_uuid(100));
INSERT INTO public.activities VALUES (public.test_uuid(210), public.test_uuid(5));
INSERT INTO public.competitions VALUES
    (public.test_uuid(220), public.test_uuid(6), NULL),
    (public.test_uuid(221), NULL, public.test_uuid(101));
INSERT INTO public.children VALUES (public.test_uuid(300), public.test_uuid(2), 'Copilul părintelui');
INSERT INTO public.enrollments(id, kind, entity_id, child_id, adult_profile_id) VALUES
    (public.test_uuid(400), 'COURSE', public.test_uuid(200), public.test_uuid(300), NULL),
    (public.test_uuid(401), 'ACTIVITY', public.test_uuid(210), public.test_uuid(300), NULL),
    (public.test_uuid(402), 'COMPETITION', public.test_uuid(220), public.test_uuid(300), NULL),
    (public.test_uuid(403), 'COMPETITION', public.test_uuid(221), public.test_uuid(300), NULL),
    (public.test_uuid(404), 'CAMP', public.test_uuid(230), NULL, public.test_uuid(7));
INSERT INTO public.payments(id, enrollment_id, amount, status, billing_name, billing_email,
        billing_address_line1, card_last4, client_secret)
SELECT public.test_uuid(500 + n), public.test_uuid(400 + n), 10000, 'SUCCEEDED', 'Părinte Test',
       'parinte' || n || '@example.test', 'Strada Test ' || n, '4242', 'pi_secret_' || n
FROM generate_series(0, 4) AS n;

CREATE TEMP TABLE visibility(phase TEXT, actor TEXT, payments INTEGER, billing_emails INTEGER);
GRANT ALL ON visibility TO authenticated;
CREATE FUNCTION pg_temp.observe(p_phase TEXT, p_actor TEXT, p_user INTEGER) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('request.jwt.claim.sub', public.test_uuid(p_user)::TEXT, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO visibility VALUES (p_phase, p_actor,
        (SELECT count(*) FROM public.payments),
        (SELECT count(billing_email) FROM public.payments));
    RESET ROLE;
END
$$;

SELECT pg_temp.observe('before', 'course coach', 3);
SELECT pg_temp.observe('before', 'course club owner', 4);
SELECT pg_temp.observe('before', 'activity coach', 5);
SELECT pg_temp.observe('before', 'competition coach organizer', 6);
SELECT pg_temp.observe('before', 'competition club organizer', 10);
DO $$
BEGIN
    IF (SELECT count(*) FROM visibility WHERE phase = 'before' AND billing_emails > 0) <> 5 THEN
        RAISE EXCEPTION 'Testul nu mai reproduce bug-ul #1367 pe politicile de dinainte de 00131.';
    END IF;
END
$$;

\i /tmp/migrations/00131_payments_organizer_access.sql

SELECT pg_temp.observe('after', 'admin', 1);
SELECT pg_temp.observe('after', 'disabled admin', 9);
SELECT pg_temp.observe('after', 'parent', 2);
SELECT pg_temp.observe('after', 'adult enrollee', 7);
SELECT pg_temp.observe('after', 'other parent', 8);
SELECT pg_temp.observe('after', 'course coach', 3);
SELECT pg_temp.observe('after', 'course club owner', 4);
SELECT pg_temp.observe('after', 'activity coach', 5);
SELECT pg_temp.observe('after', 'competition coach organizer', 6);
SELECT pg_temp.observe('after', 'competition club organizer', 10);
SELECT * FROM visibility ORDER BY phase DESC, actor;

DO $$
DECLARE
    v_expected JSONB := jsonb_build_object(
        'admin', 5, 'disabled admin', 0, 'parent', 4, 'adult enrollee', 1, 'other parent', 0,
        'course coach', 0, 'course club owner', 0, 'activity coach', 0,
        'competition coach organizer', 0, 'competition club organizer', 0);
    v_row RECORD;
BEGIN
    FOR v_row IN SELECT * FROM visibility WHERE phase = 'after' LOOP
        IF v_row.payments <> (v_expected->>v_row.actor)::INTEGER
           OR v_row.billing_emails <> v_row.payments THEN
            RAISE EXCEPTION 'Vizibilitate greșită pentru %: % plăți, % emailuri de facturare',
                v_row.actor, v_row.payments, v_row.billing_emails;
        END IF;
    END LOOP;
    IF (SELECT array_agg(policyname::TEXT ORDER BY policyname) FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'payments')
       IS DISTINCT FROM ARRAY['payments_delete', 'payments_insert', 'payments_select', 'payments_update'] THEN
        RAISE EXCEPTION 'După 00131 pe payments rămân doar politicile părinte/adult/admin.';
    END IF;
END
$$;

DO $$
BEGIN
    BEGIN
        EXECUTE pg_read_file('/tmp/migrations/00131_payments_organizer_access.sql');
        RAISE EXCEPTION 'guard-missed';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM = 'guard-missed' THEN
            RAISE EXCEPTION 'Migrația 00131 trebuie să refuze politici schimbate între timp.';
        END IF;
    END;
END
$$;

ROLLBACK;
\echo 'payments organizer access: ok'
