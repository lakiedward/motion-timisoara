\set ON_ERROR_STOP on
INSERT INTO public.profiles (id, name, role) VALUES
    (public.test_uuid(1), 'Parent One', 'PARENT'), (public.test_uuid(2), 'Parent Two', 'PARENT'),
    (public.test_uuid(3), 'Parent Inactive', 'PARENT'), (public.test_uuid(4), 'Coach Real Name', 'COACH'),
    (public.test_uuid(5), 'Club Owner', 'CLUB'), (public.test_uuid(6), 'Other Owner', 'CLUB'),
    (public.test_uuid(7), 'Parent Camp Only', 'PARENT'), (public.test_uuid(8), 'Admin', 'ADMIN');
INSERT INTO public.clubs VALUES (public.test_uuid(11), 'Club One', public.test_uuid(5)),
    (public.test_uuid(12), 'Club Two', public.test_uuid(6));
INSERT INTO public.courses VALUES
    (public.test_uuid(21), 'Swimming', public.test_uuid(11), public.test_uuid(4), true),
    (public.test_uuid(22), 'Running', public.test_uuid(12), public.test_uuid(4), true),
    (public.test_uuid(23), 'History', public.test_uuid(11), public.test_uuid(4), false);
INSERT INTO public.activities VALUES (public.test_uuid(24), 'Club Training', public.test_uuid(11), public.test_uuid(4), true);
INSERT INTO public.camps VALUES (public.test_uuid(31), 'Camp One', public.test_uuid(11), public.test_uuid(4)),
    (public.test_uuid(32), 'Camp Two', public.test_uuid(12), public.test_uuid(4));
INSERT INTO public.children VALUES (public.test_uuid(41), public.test_uuid(1)), (public.test_uuid(42), public.test_uuid(2)),
    (public.test_uuid(43), public.test_uuid(3)), (public.test_uuid(47), public.test_uuid(7));
INSERT INTO public.enrollments VALUES
    (public.test_uuid(51), 'COURSE', public.test_uuid(21), public.test_uuid(41), 'ACTIVE'),
    (public.test_uuid(52), 'COURSE', public.test_uuid(22), public.test_uuid(42), 'ACTIVE'),
    (public.test_uuid(53), 'COURSE', public.test_uuid(21), public.test_uuid(43), 'CANCELLED'),
    (public.test_uuid(54), 'CAMP', public.test_uuid(31), public.test_uuid(41), 'ACTIVE'),
    (public.test_uuid(55), 'CAMP', public.test_uuid(31), public.test_uuid(47), 'ACTIVE'),
    (public.test_uuid(56), 'COURSE', public.test_uuid(23), public.test_uuid(41), 'ACTIVE'),
    (public.test_uuid(57), 'ACTIVITY', public.test_uuid(24), public.test_uuid(41), 'ACTIVE'),
    (public.test_uuid(58), 'CAMP', public.test_uuid(32), public.test_uuid(42), 'ACTIVE');
INSERT INTO public.course_announcements (id, course_id, author_user_id, content, pinned, created_at)
    SELECT public.test_uuid(n), public.test_uuid(21), public.test_uuid(4), 'Coach message ' || n,
        n = 101, now() - interval '2 days' FROM generate_series(101, 128) n;
INSERT INTO public.course_announcements (id, course_id, author_user_id, content, created_at) VALUES
    (public.test_uuid(130), public.test_uuid(22), public.test_uuid(4), 'Foreign course', now() - interval '1 day'),
    (public.test_uuid(131), public.test_uuid(23), public.test_uuid(4), 'Inactive course enrolled', now() - interval '1 day');
INSERT INTO public.club_announcements (id, club_id, author_user_id, title, content, audience_kind, audience_id, created_at) VALUES
    (public.test_uuid(101), public.test_uuid(11), public.test_uuid(5), 'Club announcement', 'Club channel', 'COURSE', public.test_uuid(21), now() - interval '2 days'),
    (public.test_uuid(201), public.test_uuid(11), public.test_uuid(5), 'Club-wide', 'General', 'CLUB', NULL, now() - interval '1 day'),
    (public.test_uuid(202), public.test_uuid(11), public.test_uuid(5), 'Camp-specific', 'Camp message', 'CAMP', public.test_uuid(31), now() - interval '1 day'),
    (public.test_uuid(203), public.test_uuid(12), public.test_uuid(6), 'Other camp', 'Foreign message', 'CAMP', public.test_uuid(32), now() - interval '1 day'),
    (public.test_uuid(204), public.test_uuid(12), public.test_uuid(6), 'Forged camp', 'Wrong owner', 'CAMP', public.test_uuid(31), now() - interval '1 day'),
    (public.test_uuid(205), public.test_uuid(11), public.test_uuid(5), 'Hidden', 'Hidden message', 'CLUB', NULL, now() - interval '1 day'),
    (public.test_uuid(206), public.test_uuid(11), public.test_uuid(5), 'Scheduled', 'Future message', 'CLUB', NULL, now() - interval '2 days'),
    (public.test_uuid(207), public.test_uuid(11), public.test_uuid(5), 'Expired', 'Expired message', 'CLUB', NULL, now() - interval '1 day'),
    (public.test_uuid(208), public.test_uuid(11), public.test_uuid(5), 'Published later', 'Scheduled became visible', 'CLUB', NULL, now() - interval '10 days'),
    (public.test_uuid(209), public.test_uuid(11), public.test_uuid(5), 'Activity', 'Activity message', 'ACTIVITY', public.test_uuid(24), now() - interval '1 day');
UPDATE public.club_announcements SET is_active = false WHERE id = public.test_uuid(205);
UPDATE public.club_announcements SET publish_at = now() + interval '1 day' WHERE id = public.test_uuid(206);
UPDATE public.club_announcements SET expires_at = now() - interval '1 hour' WHERE id = public.test_uuid(207);
UPDATE public.club_announcements SET publish_at = now() - interval '1 hour' WHERE id = public.test_uuid(208);
INSERT INTO public.announcement_attachments (id, announcement_id, club_announcement_id, type, url) VALUES
    (public.test_uuid(301), public.test_uuid(101), NULL, 'URL', 'https://example.test/coach'),
    (public.test_uuid(302), NULL, public.test_uuid(101), 'URL', 'https://example.test/club'),
    (public.test_uuid(303), NULL, public.test_uuid(203), 'URL', 'https://example.test/foreign');
CREATE TABLE public.test_pages (page_number INTEGER PRIMARY KEY, payload JSONB NOT NULL);
GRANT SELECT, INSERT ON public.test_pages TO authenticated;

SELECT public.test_assert((SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN (
    'public.course_announcements'::regclass, 'public.club_announcements'::regclass,
    'public.profiles'::regclass, 'public.enrollments'::regclass, 'public.children'::regclass,
    'public.user_announcement_views'::regclass)), 'all queried private tables use real RLS');
SELECT public.test_assert((SELECT bool_and(NOT prosecdef) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
    AND proname IN ('get_parent_announcement_feed', 'get_parent_announcement_courses', 'mark_parent_announcements_seen')),
    'feed, filter and watermark functions use invoker rights');
SELECT public.test_assert(NOT has_column_privilege('authenticated', 'public.profiles', 'email', 'SELECT')
    AND has_column_privilege('authenticated', 'public.profiles', 'name', 'SELECT'), 'profile names readable without contact columns');
SET ROLE anon;
DO $$ BEGIN
    BEGIN PERFORM public.get_parent_announcement_feed(); RAISE EXCEPTION 'Anonymous feed accepted';
    EXCEPTION WHEN insufficient_privilege THEN PERFORM public.test_assert(true, 'anonymous feed denied'); END;
    BEGIN PERFORM public.get_parent_announcement_courses(); RAISE EXCEPTION 'Anonymous filter accepted';
    EXCEPTION WHEN insufficient_privilege THEN PERFORM public.test_assert(true, 'anonymous filter denied'); END;
    BEGIN PERFORM public.test_mark_seen(now()); RAISE EXCEPTION 'Anonymous watermark accepted';
    EXCEPTION WHEN insufficient_privilege THEN PERFORM public.test_assert(true, 'anonymous watermark denied'); END;
END $$;
RESET ROLE;
SET ROLE authenticated;
SELECT public.test_actor(1);
SELECT public.test_assert(current_user = 'authenticated', 'parent assertions execute as authenticated');
INSERT INTO public.test_pages VALUES (1, public.test_feed());
INSERT INTO public.test_pages SELECT 2, public.test_feed(NULL, payload) FROM public.test_pages WHERE page_number = 1;
SELECT public.test_assert((SELECT jsonb_array_length(payload->'items') = 20 AND payload->'nextCursor' <> 'null'::JSONB
    FROM public.test_pages WHERE page_number = 1), 'first page capped at twenty with next cursor');
SELECT public.test_assert((SELECT jsonb_array_length(payload->'items') = 14 AND payload->'nextCursor' = 'null'::JSONB
    FROM public.test_pages WHERE page_number = 2), 'second page completes both channels without an extra request');
SELECT public.test_assert((SELECT count(*) = 34 AND count(DISTINCT (item->>'source', item->>'id')) = 34
    FROM public.test_pages p, jsonb_array_elements(p.payload->'items') item), 'equal timestamps and cross-table identical UUIDs have unique cursor identities');
SELECT public.test_assert((SELECT (payload->'items'->0->>'pinned')::BOOLEAN AND payload->'items'->1->>'title' = 'Published later'
    FROM public.test_pages WHERE page_number = 1), 'pinned first then actual publication date across sources');
SELECT public.test_assert((SELECT payload->'items'->0->>'authorName' = 'Coach Real Name'
    AND payload->'items'->0->>'courseName' = 'Swimming' AND payload->'items'->0->>'courseId' = public.test_uuid(21)::TEXT
    FROM public.test_pages WHERE page_number = 1), 'coach author and course link identity are separate');
SELECT public.test_assert((SELECT item->>'authorName' = 'Club One' AND item->>'audienceName' = 'Camp One'
    FROM public.test_pages p, jsonb_array_elements(p.payload->'items') item WHERE item->>'id' = public.test_uuid(202)::TEXT),
    'camp card carries actual club and target names');
SELECT public.test_assert(NOT EXISTS (SELECT FROM public.test_pages p, jsonb_array_elements(p.payload->'items') item
    WHERE item ? 'email' OR item ? 'phone' OR item ? 'author_user_id'), 'feed returns no author personal fields');
SELECT public.test_assert((SELECT payload->'previousSeenAt' = 'null'::JSONB FROM public.test_pages WHERE page_number = 1)
    AND NOT EXISTS (SELECT FROM public.user_announcement_views), 'reading alone preserves unseen state');
SELECT public.test_assert((SELECT (payload->>'asOf')::TIMESTAMPTZ <= statement_timestamp()
    AND payload->>'asOf' = (SELECT payload->>'asOf' FROM public.test_pages WHERE page_number = 1)
    FROM public.test_pages WHERE page_number = 2), 'pagination preserves server asOf without clock conversion');
SELECT public.test_assert((SELECT count(*) = 2 AND bool_and(id IN (public.test_uuid(21), public.test_uuid(23)))
    FROM public.get_parent_announcement_courses()), 'filter lists own active enrollments including inactive historical course');
INSERT INTO public.test_pages VALUES (3, public.test_feed(21));
INSERT INTO public.test_pages SELECT 4, public.test_feed(21, payload) FROM public.test_pages WHERE page_number = 3;
SELECT public.test_assert((SELECT count(*) = 29 AND bool_and(item->>'courseId' = public.test_uuid(21)::TEXT)
    FROM public.test_pages p, jsonb_array_elements(p.payload->'items') item WHERE page_number IN (3, 4)),
    'course filter includes both channels and excludes unrelated club-wide and camp messages');
SELECT public.test_assert(jsonb_array_length(public.test_feed(22)->'items') = 0, 'foreign course filter cannot bypass RLS');
SELECT public.test_assert((SELECT count(*) = 2 FROM public.announcement_attachments), 'media reads permit both sources and deny foreign attachments');
RESET ROLE;
UPDATE public.course_announcements SET pinned = false WHERE id = public.test_uuid(101);
SET ROLE authenticated;
SELECT public.test_actor(1);
DO $$ BEGIN
    BEGIN PERFORM public.test_feed(NULL, (SELECT payload FROM public.test_pages WHERE page_number = 1));
        RAISE EXCEPTION 'Depinned row accepted by old cursor';
    EXCEPTION WHEN SQLSTATE 'PT409' THEN PERFORM public.test_assert(true, 'depinning between pages returns explicit ordering conflict'); END;
END $$;
INSERT INTO public.test_pages SELECT 5, public.get_parent_announcement_feed(
    p_as_of => (payload->>'asOf')::TIMESTAMPTZ) FROM public.test_pages WHERE page_number = 1;
INSERT INTO public.test_pages SELECT 6, public.test_feed(NULL, payload) FROM public.test_pages WHERE page_number = 5;
SELECT public.test_assert((SELECT count(*) = 34 AND count(DISTINCT (item->>'source', item->>'id')) = 34
    FROM public.test_pages p, jsonb_array_elements(p.payload->'items') item WHERE page_number IN (5, 6)),
    'refresh after depin returns the whole snapshot once without omissions or duplicates');
SELECT public.test_assert((SELECT payload->>'asOf' = (SELECT payload->>'asOf' FROM public.test_pages WHERE page_number = 1)
    AND payload->'nextCursor'->>'orderVersion' <> (SELECT payload->'nextCursor'->>'orderVersion' FROM public.test_pages WHERE page_number = 1)
    FROM public.test_pages WHERE page_number = 5), 'refresh keeps asOf and changes the ordering version');
RESET ROLE;
UPDATE public.course_announcements SET pinned = true WHERE id = public.test_uuid(102);
SET ROLE authenticated;
SELECT public.test_actor(1);
DO $$ BEGIN
    BEGIN PERFORM public.test_feed(NULL, (SELECT payload FROM public.test_pages WHERE page_number = 5));
        RAISE EXCEPTION 'Newly pinned row accepted by old cursor';
    EXCEPTION WHEN SQLSTATE 'PT409' THEN PERFORM public.test_assert(true, 'pinning a later row between pages returns explicit ordering conflict'); END;
END $$;
INSERT INTO public.test_pages SELECT 7, public.get_parent_announcement_feed(
    p_as_of => (payload->>'asOf')::TIMESTAMPTZ) FROM public.test_pages WHERE page_number = 1;
INSERT INTO public.test_pages SELECT 8, public.test_feed(NULL, payload) FROM public.test_pages WHERE page_number = 7;
SELECT public.test_assert((SELECT count(*) = 34 AND count(DISTINCT (item->>'source', item->>'id')) = 34
    FROM public.test_pages p, jsonb_array_elements(p.payload->'items') item WHERE page_number IN (7, 8)),
    'refresh after pin returns the whole snapshot once without omissions or duplicates');
RESET ROLE;
UPDATE public.course_announcements SET pinned = id = public.test_uuid(101) WHERE id IN (public.test_uuid(101), public.test_uuid(102));
SET ROLE authenticated;
SELECT public.test_actor(1);
DO $$ DECLARE v_limit INTEGER; BEGIN
    FOREACH v_limit IN ARRAY ARRAY[0, 51, NULL] LOOP
        BEGIN PERFORM public.get_parent_announcement_feed(p_page_size => v_limit); RAISE EXCEPTION 'Invalid limit accepted';
        EXCEPTION WHEN invalid_parameter_value THEN PERFORM public.test_assert(true, 'invalid page limit denied'); END;
    END LOOP;
    BEGIN PERFORM public.get_parent_announcement_feed(p_before_id => public.test_uuid(101)); RAISE EXCEPTION 'Partial cursor accepted';
    EXCEPTION WHEN invalid_parameter_value THEN PERFORM public.test_assert(true, 'partial cursor denied'); END;
    BEGIN PERFORM public.get_parent_announcement_feed(p_as_of => 'infinity'); RAISE EXCEPTION 'Infinite snapshot accepted';
    EXCEPTION WHEN invalid_parameter_value THEN PERFORM public.test_assert(true, 'infinite snapshot denied'); END;
    BEGIN PERFORM public.get_parent_announcement_feed(p_as_of => now() + interval '1 day'); RAISE EXCEPTION 'Future snapshot accepted';
    EXCEPTION WHEN invalid_parameter_value THEN PERFORM public.test_assert(true, 'future snapshot denied'); END;
    BEGIN PERFORM public.get_parent_announcement_feed(NULL, now(), false, now(), 'private', public.test_uuid(101));
        RAISE EXCEPTION 'Unknown source accepted';
    EXCEPTION WHEN invalid_parameter_value THEN PERFORM public.test_assert(true, 'unknown cursor source denied'); END;
    BEGIN PERFORM public.get_parent_announcement_feed(NULL, now(), false, now(), 'coach', public.test_uuid(101));
        RAISE EXCEPTION 'Unversioned cursor accepted';
    EXCEPTION WHEN invalid_parameter_value THEN PERFORM public.test_assert(true, 'cursor ordering version is mandatory'); END;
END $$;
SELECT public.test_actor(2);
SELECT public.test_assert(jsonb_array_length(public.test_feed()->'items') = 2, 'other parent sees only own course and camp');
SELECT public.test_assert((SELECT count(*) = 1 AND bool_and(id = public.test_uuid(22)) FROM public.get_parent_announcement_courses()),
    'course filter does not disclose another parent enrollments');
SELECT public.test_actor(3);
SELECT public.test_assert(jsonb_array_length(public.test_feed()->'items') = 0
    AND NOT EXISTS (SELECT FROM public.get_parent_announcement_courses()), 'cancelled enrollment gives empty feed and filters');
SELECT public.test_actor(7);
SELECT public.test_assert(jsonb_array_length(public.test_feed()->'items') = 3, 'camp-only parent sees camp and general club messages');
SELECT public.test_assert(NOT EXISTS (SELECT FROM jsonb_array_elements(public.test_feed()->'items') item
    WHERE item->>'title' IN ('Forged camp', 'Hidden', 'Expired', 'Scheduled')), 'foreign ownership and publication gates remain enforced');
SELECT public.test_actor(5);
SELECT public.test_assert((SELECT count(*) > 0 FROM public.club_announcements) AND jsonb_array_length(public.test_feed()->'items') = 0,
    'owner parent feed cannot display owner-only announcements without child enrollment');
DO $$ BEGIN
    BEGIN INSERT INTO public.club_announcements (id, club_id, author_user_id, title, content, audience_kind, audience_id)
        VALUES (public.test_uuid(299), public.test_uuid(11), public.test_uuid(5), 'Attack', 'Wrong camp', 'CAMP', public.test_uuid(32));
        RAISE EXCEPTION 'Foreign camp accepted';
    EXCEPTION WHEN insufficient_privilege THEN PERFORM public.test_assert(true, 'CAMP migration rejects cross-club publication'); END;
END $$;
SELECT public.test_actor(1);
SELECT public.test_mark_seen((SELECT (payload->>'asOf')::TIMESTAMPTZ FROM public.test_pages WHERE page_number = 1));
SELECT public.test_assert((SELECT last_seen_at = (SELECT (payload->>'asOf')::TIMESTAMPTZ FROM public.test_pages WHERE page_number = 1)
    FROM public.user_announcement_views), 'accepted visit advances only to server snapshot');
SELECT public.test_mark_seen(now() - interval '30 days');
SELECT public.test_assert((SELECT last_seen_at = (SELECT (payload->>'asOf')::TIMESTAMPTZ FROM public.test_pages WHERE page_number = 1)
    FROM public.user_announcement_views), 'older visit cannot rewind watermark');
UPDATE public.user_announcement_views SET last_seen_at = now() - interval '30 days';
SELECT public.test_assert((SELECT last_seen_at = (SELECT (payload->>'asOf')::TIMESTAMPTZ FROM public.test_pages WHERE page_number = 1)
    FROM public.user_announcement_views), 'direct update cannot rewind watermark either');
SELECT public.test_assert((public.test_feed()->>'previousSeenAt')::TIMESTAMPTZ =
    (SELECT last_seen_at FROM public.user_announcement_views), 'subsequent visit receives stored baseline');
DO $$ BEGIN
    BEGIN INSERT INTO public.user_announcement_views VALUES (public.test_uuid(2), now()); RAISE EXCEPTION 'Foreign visit accepted';
    EXCEPTION WHEN insufficient_privilege THEN PERFORM public.test_assert(true, 'cannot mark another parent visit'); END;
    BEGIN PERFORM public.mark_parent_announcements_seen(now(), public.test_uuid(2)); RAISE EXCEPTION 'Changed identity accepted';
    EXCEPTION WHEN insufficient_privilege THEN PERFORM public.test_assert(true, 'delayed retry rejects a different authenticated identity'); END;
    BEGIN PERFORM public.mark_parent_announcements_seen(now(), NULL); RAISE EXCEPTION 'Missing expected identity accepted';
    EXCEPTION WHEN insufficient_privilege THEN PERFORM public.test_assert(true, 'expected identity is mandatory'); END;
    BEGIN PERFORM public.test_mark_seen('infinity'); RAISE EXCEPTION 'Infinite visit accepted';
    EXCEPTION WHEN invalid_parameter_value THEN PERFORM public.test_assert(true, 'non-finite watermark denied'); END;
    BEGIN PERFORM public.test_mark_seen(NULL); RAISE EXCEPTION 'Null visit accepted';
    EXCEPTION WHEN invalid_parameter_value THEN PERFORM public.test_assert(true, 'null watermark denied'); END;
END $$;
SELECT public.test_mark_seen(now() + interval '10 years');
SELECT public.test_assert((SELECT last_seen_at <= statement_timestamp() FROM public.user_announcement_views), 'future visit clamped to database clock');
SELECT public.test_actor(2);
SELECT public.test_assert(NOT EXISTS (SELECT FROM public.user_announcement_views), 'watermark is private to each parent');
RESET ROLE;

INSERT INTO public.course_announcements (id, course_id, author_user_id, content)
    VALUES (public.test_uuid(150), public.test_uuid(21), public.test_uuid(4), 'New while browsing');
DELETE FROM public.course_announcements WHERE id = public.test_uuid(127);
UPDATE public.club_announcements SET expires_at = now() - interval '1 second' WHERE id = public.test_uuid(202);
SET ROLE authenticated;
SELECT public.test_actor(1);
SELECT public.test_assert(NOT EXISTS (SELECT FROM jsonb_array_elements(public.get_parent_announcement_feed(
    p_as_of => (SELECT (payload->>'asOf')::TIMESTAMPTZ FROM public.test_pages WHERE page_number = 1), p_page_size => 50)->'items') item
    WHERE item->>'id' IN (public.test_uuid(150)::TEXT, public.test_uuid(202)::TEXT)),
    'existing snapshot excludes new arrivals and rechecks expiry');
SELECT public.test_assert(EXISTS (SELECT FROM jsonb_array_elements(public.test_feed()->'items') item
    WHERE item->>'id' = public.test_uuid(150)::TEXT), 'new visit discovers new arrivals');
DO $$ BEGIN
    BEGIN PERFORM public.test_feed(NULL, (SELECT payload FROM public.test_pages WHERE page_number = 1));
        RAISE EXCEPTION 'Removed rows accepted by old cursor';
    EXCEPTION WHEN SQLSTATE 'PT409' THEN PERFORM public.test_assert(true, 'deletion and expiry invalidate ordering instead of silently shifting pages'); END;
END $$;
SELECT set_config('request.jwt.claim.sub', '', false);
DO $$ BEGIN
    BEGIN PERFORM public.test_feed(); RAISE EXCEPTION 'Missing identity accepted';
    EXCEPTION WHEN insufficient_privilege THEN PERFORM public.test_assert(true, 'authenticated role still requires a caller identity'); END;
END $$;
RESET ROLE;
INSERT INTO public.profiles (id, name, role) VALUES (public.test_uuid(9), 'Replacement Coach', 'COACH');
INSERT INTO public.courses VALUES (public.test_uuid(25), 'Transferred Course', public.test_uuid(11), public.test_uuid(4), true);
INSERT INTO public.course_announcements (id, course_id, author_user_id, content)
    VALUES (public.test_uuid(250), public.test_uuid(25), public.test_uuid(4), 'Historical message');
UPDATE public.courses SET coach_id = public.test_uuid(9) WHERE id = public.test_uuid(25);
SET ROLE authenticated;
SELECT public.test_actor(4);
DO $$ BEGIN
    BEGIN INSERT INTO public.course_announcements (id, course_id, author_user_id, content)
        VALUES (public.test_uuid(251), public.test_uuid(21), public.test_uuid(8), 'Pretend to be admin');
        RAISE EXCEPTION 'Coach forged an admin author';
    EXCEPTION WHEN insufficient_privilege THEN PERFORM public.test_assert(true, 'coach cannot insert own-course message under another author'); END;
    BEGIN UPDATE public.course_announcements SET author_user_id = public.test_uuid(8) WHERE id = public.test_uuid(101);
        RAISE EXCEPTION 'Coach changed saved author';
    EXCEPTION WHEN check_violation THEN PERFORM public.test_assert(true, 'coach cannot reattribute an existing announcement'); END;
    BEGIN UPDATE public.course_announcements SET id = public.test_uuid(252) WHERE id = public.test_uuid(101);
        RAISE EXCEPTION 'Coach changed stable identity';
    EXCEPTION WHEN check_violation THEN PERFORM public.test_assert(true, 'announcement identity remains stable for cursor and media references'); END;
END $$;
INSERT INTO public.course_announcements (id, course_id, author_user_id, content)
    VALUES (public.test_uuid(251), public.test_uuid(21), public.test_uuid(4), 'Genuine coach message');
UPDATE public.course_announcements SET content = 'Edited genuine message', pinned = true WHERE id = public.test_uuid(251);
SELECT public.test_assert((SELECT content = 'Edited genuine message' AND pinned AND author_user_id = public.test_uuid(4)
    FROM public.course_announcements WHERE id = public.test_uuid(251)), 'own-course creation and content/pin edits remain authorized');
SELECT public.test_actor(9);
UPDATE public.course_announcements SET content = 'Updated after course transfer' WHERE id = public.test_uuid(250);
SELECT public.test_assert((SELECT content = 'Updated after course transfer' AND author_user_id = public.test_uuid(4)
    FROM public.course_announcements WHERE id = public.test_uuid(250)), 'replacement coach edits content while preserving historical author');
DO $$ BEGIN
    BEGIN UPDATE public.course_announcements SET author_user_id = public.test_uuid(9) WHERE id = public.test_uuid(250);
        RAISE EXCEPTION 'Replacement coach took authorship';
    EXCEPTION WHEN check_violation THEN PERFORM public.test_assert(true, 'course transfer does not permit claiming historical authorship'); END;
    BEGIN INSERT INTO public.course_announcements (id, course_id, author_user_id, content)
        VALUES (public.test_uuid(252), public.test_uuid(21), public.test_uuid(9), 'Foreign-course message');
        RAISE EXCEPTION 'Foreign course write accepted';
    EXCEPTION WHEN insufficient_privilege THEN PERFORM public.test_assert(true, 'new author check preserves course ownership restrictions'); END;
END $$;
SELECT public.test_actor(8);
INSERT INTO public.course_announcements (id, course_id, author_user_id, content)
    VALUES (public.test_uuid(253), public.test_uuid(21), public.test_uuid(8), 'Admin authored message');
UPDATE public.course_announcements SET content = 'Admin content correction' WHERE id = public.test_uuid(250);
SELECT public.test_assert((SELECT content = 'Admin content correction' AND author_user_id = public.test_uuid(4)
    FROM public.course_announcements WHERE id = public.test_uuid(250))
    AND EXISTS (SELECT FROM public.course_announcements WHERE id = public.test_uuid(253) AND author_user_id = public.test_uuid(8)),
    'admin can publish to any course and correct historical content without rewriting attribution');
DO $$ BEGIN
    BEGIN INSERT INTO public.course_announcements (id, course_id, author_user_id, content)
        VALUES (public.test_uuid(254), public.test_uuid(21), public.test_uuid(4), 'Admin impersonation');
        RAISE EXCEPTION 'Admin forged an author';
    EXCEPTION WHEN insufficient_privilege THEN PERFORM public.test_assert(true, 'admin publication also records the actual caller'); END;
    BEGIN UPDATE public.course_announcements SET author_user_id = public.test_uuid(8) WHERE id = public.test_uuid(250);
        RAISE EXCEPTION 'Admin rewrote historical author';
    EXCEPTION WHEN check_violation THEN PERFORM public.test_assert(true, 'historical attribution survives admin content corrections'); END;
END $$;
SELECT public.test_actor(1);
SELECT public.test_assert(EXISTS (SELECT FROM jsonb_array_elements(public.test_feed()->'items') item
    WHERE item->>'id' = public.test_uuid(251)::TEXT AND item->>'authorName' = 'Coach Real Name')
    AND NOT EXISTS (SELECT FROM jsonb_array_elements(public.test_feed()->'items') item WHERE item->>'id' = public.test_uuid(254)::TEXT),
    'parent feed displays genuine new authors and no impersonated insertion');
RESET ROLE;
SELECT count(*) AS passed_assertions FROM public.test_results;
