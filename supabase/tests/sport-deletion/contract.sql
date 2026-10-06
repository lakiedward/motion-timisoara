\set ON_ERROR_STOP on
\o /dev/null
BEGIN;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT);
\i /tmp/migrations/00001_schema.sql
\i /tmp/migrations/00081_restrict_sport_deletion.sql

CREATE FUNCTION public.test_uuid(v INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
  SELECT ('00000000-0000-0000-0000-' || lpad(v::TEXT, 12, '0'))::UUID
$$;
CREATE FUNCTION public.test_assert(ok BOOLEAN, label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%', label; END IF; END;
$$;
CREATE FUNCTION public.test_try_delete(v INTEGER) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.sports WHERE id = public.test_uuid(v);
  RETURN 'OK';
EXCEPTION WHEN foreign_key_violation THEN RETURN SQLSTATE;
END;
$$;
CREATE FUNCTION public.test_try_club_sport(v INTEGER) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.club_sports(club_id, sport_id) VALUES (public.test_uuid(100), public.test_uuid(v));
  RETURN 'OK';
EXCEPTION WHEN foreign_key_violation THEN RETURN SQLSTATE;
END;
$$;

INSERT INTO auth.users(id, email) VALUES (public.test_uuid(100), 'sports-test@local.test');
INSERT INTO public.profiles(id, email, name, role)
  VALUES (public.test_uuid(100), 'sports-test@local.test', 'Local coach', 'COACH');
INSERT INTO public.coach_profiles(id, user_id) VALUES (public.test_uuid(100), public.test_uuid(100));
INSERT INTO public.clubs(id, owner_user_id, name) VALUES (public.test_uuid(100), public.test_uuid(100), 'Local club');
INSERT INTO public.locations(id, name, type) VALUES (public.test_uuid(100), 'Local pool', 'POOL');
INSERT INTO public.sports(id, code, name)
  SELECT public.test_uuid(v), 'SPORT_' || v, 'Sport ' || v FROM generate_series(1, 8) v;
INSERT INTO public.courses(id, name, sport_id, coach_id, location_id)
  VALUES (public.test_uuid(1), 'Local course', public.test_uuid(1), public.test_uuid(100), public.test_uuid(100));
INSERT INTO public.activities(id, name, sport_id, coach_id, location_id, activity_date, start_time, end_time)
  VALUES (public.test_uuid(2), 'Local activity', public.test_uuid(2), public.test_uuid(100), public.test_uuid(100), '2026-10-10', '10:00', '11:00');
INSERT INTO public.coach_sports(coach_profile_id, sport_id) VALUES (public.test_uuid(100), public.test_uuid(3));
INSERT INTO public.club_sports(club_id, sport_id) VALUES (public.test_uuid(100), public.test_uuid(4));

SELECT public.test_assert(public.test_try_delete(1) = '23503', 'course reference blocks sport deletion');
SELECT public.test_assert(public.test_try_delete(2) = '23503', 'activity reference blocks sport deletion');
SELECT public.test_assert(public.test_try_delete(3) = '23503', 'coach reference blocks sport deletion');
SELECT public.test_assert(public.test_try_delete(4) = '23503', 'club reference blocks sport deletion');
SELECT public.test_assert((SELECT count(*) = 4 FROM public.sports WHERE id IN (public.test_uuid(1), public.test_uuid(2), public.test_uuid(3), public.test_uuid(4))), 'referenced sports remain');
SELECT public.test_assert((SELECT count(*) = 1 FROM public.courses) AND (SELECT count(*) = 1 FROM public.activities)
  AND (SELECT count(*) = 1 FROM public.coach_sports) AND (SELECT count(*) = 1 FROM public.club_sports), 'all associations survive rejected deletion');
SELECT public.test_assert(public.test_try_delete(5) = 'OK', 'unused sport deletion succeeds');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.sports WHERE id = public.test_uuid(5)), 'unused sport is removed');
SELECT public.test_assert((SELECT bool_and(confdeltype = 'r') AND count(*) = 2 FROM pg_constraint
  WHERE conname IN ('coach_sports_sport_id_fkey', 'club_sports_sport_id_fkey')), 'both former cascade constraints restrict sport deletion');
COMMIT;
\o
\echo All isolated sport deletion contracts passed.
