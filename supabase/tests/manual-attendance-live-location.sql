\set ON_ERROR_STOP on
\i /tmp/00155_manual_attendance_live_location.sql
BEGIN;

INSERT INTO public.course_occurrences (id, course_id, starts_at, ends_at)
VALUES (public.test_uuid(107), public.test_uuid(11),
    clock_timestamp() - interval '10 minutes', clock_timestamp() + interval '30 minutes');

SET LOCAL ROLE service_role;
SELECT public.test_assert(public.test_live(1,'start',107,'{"consent":true}')->>'success'='true',
    'coach starts a fresh share for the exact occurrence');
SELECT public.test_assert(public.test_live(1,'update',107,public.test_session(107)||public.test_point())->>'success'='true',
    'coach uploads a current point');
SELECT public.test_assert(public.test_live(8,'status',107)->>'code'='NOT_ELIGIBLE',
    'active enrollment without presence cannot discover the share');
SELECT ('coach-live-location:' || (public.test_session(107)->>'sessionId')) AS live_topic \gset
SELECT count(*) AS messages_before_mark FROM realtime.messages WHERE topic=:'live_topic' \gset
SELECT public.test_assert(public.test_record(900,202,'PRESENT',false,107)->>'outcome'='recorded',
    'coach records manual attendance through the attendance RPC');
SELECT public.test_assert((
    SELECT count(*) > :messages_before_mark
        AND bool_and(event='invalidate' AND private AND payload='{}'::JSONB)
    FROM realtime.messages WHERE topic=:'live_topic'
), 'manual mark broadcasts a private invalidation without coordinates');
SELECT public.test_assert((SELECT manual_override AND NOT qr_processed FROM public.attendance_accounting
    WHERE occurrence_id=public.test_uuid(107) AND child_id=public.test_uuid(202)),
    'attendance receipt is manual without a QR scan');
SELECT public.test_assert(EXISTS (
    SELECT FROM jsonb_array_elements(public.coach_live_location_transaction(public.test_uuid(8),'{"action":"list"}')->'sessions') item
    WHERE item->>'occurrenceId'=public.test_uuid(107)::TEXT AND NOT (item ? 'location')
), 'manually marked parent sees metadata in the list');
SELECT public.test_assert(public.test_live(8,'status',107)->>'sessionId'=public.test_session(107)->>'sessionId',
    'manually marked parent can open the share');
SELECT public.test_assert(public.test_live(8,'read',107,public.test_session(107))->>'code'='CONSENT_REQUIRED',
    'no point is disclosed without consent');
SELECT public.test_assert(public.test_live(9,'consent',107,public.test_session(107)||'{"consent":true}')->>'code'='NOT_ELIGIBLE',
    'attendance in another occurrence does not grant access');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', public.test_uuid(8)::TEXT, true);
SELECT public.test_assert(private.can_receive_coach_live_location_events(:'live_topic'),
    'manually marked parent can subscribe to Realtime invalidations before consent');
SELECT set_config('request.jwt.claim.sub', public.test_uuid(9)::TEXT, true);
SELECT public.test_assert(NOT private.can_receive_coach_live_location_events(:'live_topic'),
    'other parent cannot subscribe');
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT public.test_assert(public.test_live(8,'consent',107,public.test_session(107)||'{"consent":true}')->>'success'='true',
    'parent can opt in after manual attendance');
SELECT public.test_assert((public.test_live(8,'read',107,public.test_session(107))->'location'->>'latitude')::NUMERIC=45.75,
    'consented parent reads the current point');
SELECT public.test_assert(public.test_record(901,202,'ABSENT',false,107)->>'outcome'='recorded',
    'coach corrects attendance to absent');
SELECT public.test_assert(NOT EXISTS (
    SELECT FROM jsonb_array_elements(public.coach_live_location_transaction(public.test_uuid(8),'{"action":"list"}')->'sessions') item
    WHERE item->>'occurrenceId'=public.test_uuid(107)::TEXT
), 'correcting the mark removes the course from discovery');
SELECT public.test_assert(public.test_live(8,'read',107,public.test_session(107))->>'code'='NOT_ELIGIBLE',
    'existing consent grants no point after correction');

SELECT public.test_record(902,202,'PRESENT',false,107);
SELECT public.test_record(903,202,NULL,false,107);
SELECT public.test_assert(public.test_live(8,'read',107,public.test_session(107))->>'code'='NOT_ELIGIBLE',
    'clearing attendance removes point access');
RESET ROLE;

UPDATE public.enrollments SET status='CANCELLED' WHERE id=public.test_uuid(1202);
INSERT INTO public.attendance (occurrence_id, child_id, status)
VALUES (public.test_uuid(107), public.test_uuid(202), 'PRESENT');

SET LOCAL ROLE service_role;
SELECT public.test_assert(public.test_live(8,'read',107,public.test_session(107))->>'code'='NOT_ELIGIBLE',
    'presence without an active course enrollment grants no access');

SELECT public.test_record(904,201,'PRESENT',true,107);
SELECT public.test_assert(public.test_live(2,'consent',107,public.test_session(107)||'{"consent":true}')->>'success'='true',
    'QR attendance still permits parent consent');
SELECT public.test_assert(public.test_live(2,'read',107,public.test_session(107)) ? 'location',
    'QR attendance still grants access after consent');
RESET ROLE;

ROLLBACK;
