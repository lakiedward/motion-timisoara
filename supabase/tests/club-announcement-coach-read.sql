\set ON_ERROR_STOP on
RESET ROLE;
INSERT INTO public.club_announcements (id, club_id, author_user_id, title, content, audience_kind, audience_id, created_at) VALUES
    (public.test_uuid(210), public.test_uuid(11), public.test_uuid(5), 'Hidden course', 'Hidden from the course', 'COURSE', public.test_uuid(21), now() - interval '1 day'),
    (public.test_uuid(211), public.test_uuid(12), public.test_uuid(6), 'Forged course', 'Other club targets course 21', 'COURSE', public.test_uuid(21), now() - interval '1 day');
UPDATE public.club_announcements SET is_active = false WHERE id = public.test_uuid(210);

SET ROLE authenticated;
SELECT public.test_actor(4);
SELECT public.test_assert(EXISTS (SELECT FROM public.club_announcements WHERE id = public.test_uuid(101))
    AND EXISTS (SELECT FROM public.announcement_attachments WHERE id = public.test_uuid(302)),
    'course coach reads the club announcement and attachment aimed at the course');
SELECT public.test_assert(NOT EXISTS (SELECT FROM public.club_announcements WHERE id IN (
    public.test_uuid(201), public.test_uuid(202), public.test_uuid(209), public.test_uuid(203))),
    'course coach does not read club-wide, camp, activity or other club announcements');
SELECT public.test_assert(NOT EXISTS (SELECT FROM public.club_announcements WHERE id = public.test_uuid(210)),
    'course coach does not read a hidden announcement');
SELECT public.test_assert(NOT EXISTS (SELECT FROM public.club_announcements WHERE id = public.test_uuid(211)),
    'course coach does not read another club announcement aimed at the course');
SELECT public.test_actor(9);
SELECT public.test_assert(NOT EXISTS (SELECT FROM public.club_announcements)
    AND NOT EXISTS (SELECT FROM public.announcement_attachments WHERE club_announcement_id IS NOT NULL),
    'a coach of no targeted course reads no club announcement');
SELECT public.test_actor(1);
SELECT public.test_assert(EXISTS (SELECT FROM public.club_announcements WHERE id = public.test_uuid(101))
    AND NOT EXISTS (SELECT FROM public.club_announcements WHERE id IN (public.test_uuid(210), public.test_uuid(211))),
    'enrolled parent still reads the course announcement and nothing hidden or forged');
SELECT public.test_actor(2);
SELECT public.test_assert(NOT EXISTS (SELECT FROM public.club_announcements WHERE id = public.test_uuid(101)),
    'parent of another course does not read the course announcement');
RESET ROLE;
SELECT count(*) AS passed_assertions FROM public.test_results;
