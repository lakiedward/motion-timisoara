\set ON_ERROR_STOP on
CREATE TABLE public.test_realtime_results (label TEXT NOT NULL);
CREATE FUNCTION public.test_realtime_assert(value BOOLEAN, label TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', label; END IF;
    INSERT INTO public.test_realtime_results VALUES (label);
END;
$$;
CREATE TABLE public.test_realtime_context (session_id UUID, topic TEXT);
GRANT SELECT ON public.test_realtime_context TO anon, authenticated, service_role;
CREATE FUNCTION public.test_realtime_topic() RETURNS TEXT LANGUAGE sql AS $$
    SELECT topic FROM public.test_realtime_context;
$$;
UPDATE public.course_occurrences SET starts_at = clock_timestamp() - INTERVAL '30 minutes',
    ends_at = clock_timestamp() + INTERVAL '30 minutes';
UPDATE public.courses SET active = true;
UPDATE public.profiles SET enabled = true;
UPDATE public.enrollments SET kind = 'COURSE', entity_id = public.test_uuid(11), status = 'ACTIVE', remaining_sessions = 10;
SET ROLE service_role;
SELECT public.test_realtime_assert(public.test_live(1, 'start', 106, '{"consent":true}')->>'success' = 'true', 'session starts with Realtime triggers');
SELECT public.test_realtime_assert(public.test_live(1, 'update', 106, public.test_session(106) || public.test_point())->>'success' = 'true', 'point updates with Realtime triggers');
SELECT public.test_realtime_assert(public.test_record(501, 201, 'PRESENT', true, 106)->>'success' = 'true', 'real QR establishes current parent eligibility');
SELECT public.test_realtime_assert(public.test_record(502, 202, 'PRESENT', false, 106)->>'success' = 'true', 'manual-only attendance fixture');
RESET ROLE;
INSERT INTO public.test_realtime_context SELECT id, 'coach-live-location:' || id::TEXT
    FROM public.coach_live_location_sessions WHERE occurrence_id = public.test_uuid(106);
SELECT public.test_realtime_assert((SELECT count(*) > 0 AND bool_and(payload = '{}'::JSONB AND event = 'invalidate'
    AND private AND extension = 'broadcast' AND topic ~ '^coach-live-location:[0-9a-f-]{36}$') FROM realtime.messages),
    'captured database broadcasts are empty private invalidations');
SELECT public.test_realtime_assert(NOT EXISTS (SELECT FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
    AND tablename IN ('coach_live_locations', 'coach_live_location_sessions', 'parent_live_location_consents', 'coach_live_location_starts')),
    'migration does not publish location or consent tables');
SELECT public.test_realtime_assert(NOT has_function_privilege('authenticated', 'private.emit_coach_live_location_invalidation(uuid)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'private.coach_live_location_transaction(uuid,jsonb)', 'EXECUTE'),
    'helper schema access does not expose mutation or notification functions');
SELECT public.test_realtime_assert(has_function_privilege('authenticated', 'private.can_receive_coach_live_location_events(text)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'private.can_receive_coach_live_location_events(text)', 'EXECUTE'), 'only authenticated clients may evaluate join helper');

SELECT set_config('realtime.topic', public.test_realtime_topic(), false);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', public.test_uuid(1)::TEXT, false);
SELECT public.test_realtime_assert(private.can_receive_coach_live_location_events(public.test_realtime_topic()), 'current enabled coach may join');
SELECT public.test_realtime_assert((SELECT count(*) > 0 FROM realtime.messages), 'actual SELECT policy permits own coach broadcasts');
SELECT set_config('request.jwt.claim.sub', public.test_uuid(6)::TEXT, false);
SELECT public.test_realtime_assert(private.can_receive_coach_live_location_events(public.test_realtime_topic()), 'owning club may join');
SELECT set_config('request.jwt.claim.sub', public.test_uuid(2)::TEXT, false);
SELECT public.test_realtime_assert(private.can_receive_coach_live_location_events(public.test_realtime_topic()), 'eligible parent may join before opt-in metadata only');
SELECT set_config('request.jwt.claim.sub', public.test_uuid(8)::TEXT, false);
SELECT public.test_realtime_assert(NOT private.can_receive_coach_live_location_events(public.test_realtime_topic()), 'manual-only parent cannot join');
SELECT set_config('request.jwt.claim.sub', public.test_uuid(9)::TEXT, false);
SELECT public.test_realtime_assert(NOT private.can_receive_coach_live_location_events(public.test_realtime_topic()), 'QR from different occurrence cannot join');
SELECT set_config('request.jwt.claim.sub', public.test_uuid(3)::TEXT, false);
SELECT public.test_realtime_assert(NOT private.can_receive_coach_live_location_events(public.test_realtime_topic()), 'foreign coach cannot join');
SELECT set_config('request.jwt.claim.sub', public.test_uuid(7)::TEXT, false);
SELECT public.test_realtime_assert(NOT private.can_receive_coach_live_location_events(public.test_realtime_topic()), 'foreign club cannot join');
SELECT set_config('request.jwt.claim.sub', public.test_uuid(4)::TEXT, false);
SELECT public.test_realtime_assert(NOT private.can_receive_coach_live_location_events(public.test_realtime_topic()), 'admin has no implicit join access');
SELECT set_config('request.jwt.claim.sub', public.test_uuid(1)::TEXT, false);
SELECT public.test_realtime_assert(NOT private.can_receive_coach_live_location_events('coach-live-location:invalid')
    AND NOT private.can_receive_coach_live_location_events('payments:anything')
    AND NOT private.can_receive_coach_live_location_events(NULL), 'malformed and foreign namespace topics deny safely');
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT public.test_realtime_assert(NOT private.can_receive_coach_live_location_events(public.test_realtime_topic()), 'authenticated role without user identity denied');
RESET ROLE;

CREATE POLICY test_broad_read ON realtime.messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY test_broad_insert ON realtime.messages FOR INSERT TO anon, authenticated WITH CHECK (true);
INSERT INTO realtime.messages(topic, extension, payload, event, private) VALUES
    ('user:synthetic:payments', 'broadcast', '{"unrelated":true}', 'payment', false),
    ((SELECT topic FROM public.test_realtime_context), 'presence', '{"participant":"synthetic"}', 'presence', true);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', public.test_uuid(3)::TEXT, false);
SELECT public.test_realtime_assert((SELECT count(*) = 0 FROM realtime.messages), 'restrictive SELECT blocks broader policy for foreign coach');
SELECT set_config('request.jwt.claim.sub', public.test_uuid(1)::TEXT, false);
SELECT public.test_realtime_assert((SELECT count(*) = 0 FROM realtime.messages WHERE extension = 'presence'), 'restrictive SELECT denies participant Presence');
DO $$ BEGIN
    BEGIN
        INSERT INTO realtime.messages(topic, extension, payload, event, private)
            VALUES (public.test_realtime_topic(), 'broadcast', '{}', 'invalidate', true);
        RAISE EXCEPTION 'client publication unexpectedly allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT public.test_realtime_assert(true, 'restrictive INSERT blocks own coach publication despite broad policy');
SELECT set_config('realtime.topic', 'user:synthetic:payments', false);
SELECT public.test_realtime_assert((SELECT count(*) = 1 FROM realtime.messages), 'unrelated payment topic remains readable');
INSERT INTO realtime.messages(topic, extension, payload, event, private)
    VALUES ('user:synthetic:payments', 'broadcast', '{}', 'payment', false);
SELECT public.test_realtime_assert((SELECT count(*) = 2 FROM realtime.messages WHERE topic = 'user:synthetic:payments'), 'unrelated payment publication policy preserved');
SELECT set_config('realtime.topic', public.test_realtime_topic(), false);
RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT public.test_realtime_assert((SELECT count(*) = 0 FROM realtime.messages), 'anonymous SELECT blocked despite broad policy');
DO $$ BEGIN
    BEGIN
        INSERT INTO realtime.messages(topic, extension, payload, event, private)
            VALUES (public.test_realtime_topic(), 'broadcast', '{}', 'invalidate', true);
        RAISE EXCEPTION 'anonymous publication unexpectedly allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT public.test_realtime_assert(true, 'anonymous publication blocked despite broad policy');
SELECT set_config('realtime.topic', 'user:synthetic:payments', false);
SELECT public.test_realtime_assert((SELECT count(*) = 2 FROM realtime.messages), 'anonymous unrelated policy unaffected');
RESET ROLE;
DROP POLICY test_broad_read ON realtime.messages;
DROP POLICY test_broad_insert ON realtime.messages;
DELETE FROM realtime.messages WHERE extension = 'presence' OR topic = 'user:synthetic:payments';

SET ROLE service_role;
SELECT public.test_realtime_assert(public.test_live(2, 'read', 106, public.test_session(106))->>'code' = 'CONSENT_REQUIRED', 'join does not grant coordinate read');
SELECT public.test_realtime_assert(public.test_live(2, 'consent', 106, public.test_session(106) || '{"consent":true,"expectedVersion":0}')->>'success' = 'true', 'parent grants consent');
SELECT public.test_realtime_assert(public.test_live(2, 'read', 106, public.test_session(106))->>'success' = 'true', 'consented parent reads through trusted transaction');
SELECT public.test_realtime_assert(public.test_live(2, 'consent', 106, public.test_session(106) || '{"consent":false,"expectedVersion":1}')->>'success' = 'true', 'parent revokes consent');
SELECT public.test_realtime_assert(public.test_live(2, 'read', 106, public.test_session(106))->>'code' = 'CONSENT_REQUIRED', 'retained subscription cannot read after revoke');
SELECT public.test_realtime_assert(public.test_record(503, 201, 'ABSENT', false, 106)->>'success' = 'true', 'presence correction succeeds with invalidation');
SELECT public.test_realtime_assert(public.test_live(2, 'read', 106, public.test_session(106))->>'code' = 'NOT_ELIGIBLE', 'retained subscription cannot read after presence revoked');
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', public.test_uuid(2)::TEXT, false);
SELECT public.test_realtime_assert(private.can_receive_coach_live_location_events(public.test_realtime_topic()), 'own consent tombstone permits metadata recovery after eligibility loss');
RESET ROLE;
UPDATE public.profiles SET enabled = false WHERE id = public.test_uuid(2);
SET ROLE authenticated;
SELECT public.test_realtime_assert(NOT private.can_receive_coach_live_location_events(public.test_realtime_topic()), 'disabled parent cannot join despite own consent tombstone');
RESET ROLE;
UPDATE public.profiles SET enabled = true WHERE id = public.test_uuid(2);
TRUNCATE realtime.messages;
UPDATE public.enrollments SET status = 'CANCELLED' WHERE id = public.test_uuid(1201);
SELECT public.test_realtime_assert((SELECT count(*) > 0 FROM realtime.messages), 'enrollment authorization change emits invalidation');
TRUNCATE realtime.messages;
SET ROLE service_role;
SELECT set_config('test.realtime_failure', 'on', false);
SELECT public.test_realtime_assert(public.test_live(1, 'update', 106, public.test_session(106) || public.test_point())->>'success' = 'true', 'notification failure cannot abort coordinate transaction');
SELECT set_config('test.realtime_failure', 'off', false);
SELECT public.test_realtime_assert(public.test_live(1, 'read', 106, public.test_session(106))->>'success' = 'true', 'point remains available after failed notification');
SELECT public.test_realtime_assert(public.test_live(1, 'stop', 106, public.test_session(106))->>'success' = 'true', 'manual stop succeeds with deletion triggers');
SELECT public.test_realtime_assert(public.test_live(2, 'read', 106,
    (SELECT jsonb_build_object('sessionId', session_id) FROM public.test_realtime_context))->>'code' = 'SESSION_NOT_FOUND', 'retained subscription cannot read stopped session');
RESET ROLE;
SELECT public.test_realtime_assert((SELECT count(*) > 0 AND bool_and(payload = '{}'::JSONB AND private AND event = 'invalidate') FROM realtime.messages), 'stop emits empty private invalidation');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', public.test_uuid(1)::TEXT, false);
SELECT public.test_realtime_assert(NOT private.can_receive_coach_live_location_events(public.test_realtime_topic()), 'new join to stopped session denied');
RESET ROLE;
SELECT count(*) AS realtime_sql_assertions FROM public.test_realtime_results;
SELECT 'SQL contracts use an isolated realtime.send capture; no WebSocket delivery is claimed.' AS scope;
