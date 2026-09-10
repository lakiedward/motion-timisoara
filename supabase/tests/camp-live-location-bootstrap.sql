\set ON_ERROR_STOP on
ALTER TABLE public.profiles ADD COLUMN name TEXT NOT NULL DEFAULT 'Audit user';
ALTER TABLE public.courses ADD COLUMN name TEXT NOT NULL DEFAULT 'Audit course';
CREATE TABLE public.coach_profiles (
    id UUID PRIMARY KEY, user_id UUID NOT NULL UNIQUE REFERENCES public.profiles ON DELETE CASCADE
);
CREATE TABLE public.camps (
    id UUID PRIMARY KEY, title TEXT NOT NULL,
    coach_id UUID REFERENCES public.profiles, club_id UUID REFERENCES public.clubs,
    period_start DATE NOT NULL, period_end DATE NOT NULL
);
CREATE TABLE public.camp_coaches (
    camp_id UUID NOT NULL REFERENCES public.camps ON DELETE CASCADE,
    coach_profile_id UUID NOT NULL REFERENCES public.coach_profiles ON DELETE CASCADE,
    status TEXT NOT NULL, PRIMARY KEY(camp_id,coach_profile_id)
);
GRANT SELECT ON public.coach_profiles,public.camps,public.camp_coaches TO service_role;
INSERT INTO public.coach_profiles VALUES (public.test_uuid(401),public.test_uuid(1)),
    (public.test_uuid(403),public.test_uuid(3)),(public.test_uuid(405),public.test_uuid(5));
INSERT INTO public.camps
    SELECT public.test_uuid(n),'Camp '||n,CASE WHEN n=302 THEN NULL ELSE public.test_uuid(CASE WHEN n=303 THEN 3 ELSE 1 END) END,
        CASE WHEN n=302 THEN public.test_uuid(21) END,
        (clock_timestamp() AT TIME ZONE 'Europe/Bucharest')::DATE-1,
        (clock_timestamp() AT TIME ZONE 'Europe/Bucharest')::DATE+1
    FROM generate_series(301,306) n;
UPDATE public.camps SET period_start=period_start+3,period_end=period_end+3 WHERE id=public.test_uuid(304);
UPDATE public.camps SET period_start=period_start-3,period_end=period_end-3 WHERE id=public.test_uuid(305);
UPDATE public.camps SET period_end=(clock_timestamp() AT TIME ZONE 'Europe/Bucharest')::DATE WHERE id=public.test_uuid(306);
INSERT INTO public.camp_coaches VALUES (public.test_uuid(301),public.test_uuid(403),'invited'),
    (public.test_uuid(302),public.test_uuid(401),'accepted'),(public.test_uuid(302),public.test_uuid(403),'accepted'),
    (public.test_uuid(302),public.test_uuid(405),'accepted');
INSERT INTO public.enrollments(id,kind,entity_id,child_id,status)
    VALUES (public.test_uuid(2201),'CAMP',public.test_uuid(301),public.test_uuid(201),'ACTIVE'),
        (public.test_uuid(2202),'CAMP',public.test_uuid(301),public.test_uuid(202),'PENDING'),
        (public.test_uuid(2203),'CAMP',public.test_uuid(302),public.test_uuid(201),'ACTIVE'),
        (public.test_uuid(2204),'CAMP',public.test_uuid(302),public.test_uuid(203),'ACTIVE');
\i /tmp/00045_camp_live_location_access.sql
\i /tmp/00046_camp_live_location_transaction.sql
\i /tmp/00047_camp_live_location_discovery.sql
