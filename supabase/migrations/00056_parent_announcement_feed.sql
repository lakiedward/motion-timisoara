CREATE OR REPLACE FUNCTION public.get_parent_announcement_feed(
    p_course_id UUID DEFAULT NULL,
    p_as_of TIMESTAMPTZ DEFAULT NULL,
    p_before_pinned BOOLEAN DEFAULT NULL,
    p_before_published_at TIMESTAMPTZ DEFAULT NULL,
    p_before_source TEXT DEFAULT NULL,
    p_before_id UUID DEFAULT NULL,
    p_page_size INTEGER DEFAULT 20,
    p_order_version TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_now TIMESTAMPTZ := statement_timestamp();
    v_as_of TIMESTAMPTZ := COALESCE(p_as_of, v_now);
    v_cursor_parts INTEGER := num_nonnulls(p_before_pinned, p_before_published_at, p_before_source, p_before_id);
    v_result JSONB;
BEGIN
    IF (SELECT auth.uid()) IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;
    IF p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 50
       OR NOT isfinite(v_as_of) OR v_as_of > v_now
       OR v_cursor_parts NOT IN (0, 4)
       OR (v_cursor_parts = 0 AND p_order_version IS NOT NULL)
       OR (v_cursor_parts = 4 AND (p_as_of IS NULL OR NOT isfinite(p_before_published_at)
           OR p_before_published_at > v_as_of OR p_before_source NOT IN ('coach', 'club')
           OR p_order_version IS NULL OR p_order_version !~ '^[a-f0-9]{32}$')) THEN
        RAISE EXCEPTION 'Invalid announcement page parameters' USING ERRCODE = '22023';
    END IF;

    WITH parent_enrollments AS MATERIALIZED (
        SELECT e.kind, e.entity_id
        FROM public.enrollments e
        JOIN public.children ch ON ch.id = e.child_id
        WHERE ch.parent_id = (SELECT auth.uid()) AND e.status = 'ACTIVE'
    ), visible AS MATERIALIZED (
        SELECT a.id, 'coach'::TEXT AS source, a.content, NULL::TEXT AS title,
            a.pinned, a.created_at AS published_at,
            COALESCE(NULLIF(btrim(pr.name), ''), 'Antrenor') AS author_name,
            co.id AS course_id, co.name AS course_name,
            'COURSE'::TEXT AS audience_kind, COALESCE(co.name, 'Curs') AS audience_name
        FROM public.course_announcements a
        LEFT JOIN public.profiles pr ON pr.id = a.author_user_id
        LEFT JOIN public.courses co ON co.id = a.course_id
        WHERE a.created_at <= v_as_of
          AND (p_course_id IS NULL OR a.course_id = p_course_id)
          AND EXISTS (SELECT FROM parent_enrollments e WHERE e.kind = 'COURSE' AND e.entity_id = a.course_id)
        UNION ALL
        SELECT a.id, 'club'::TEXT, a.content, a.title, FALSE,
            GREATEST(a.created_at, a.publish_at),
            COALESCE(NULLIF(btrim(cl.name), ''), 'Club'),
            co.id, co.name, a.audience_kind,
            CASE a.audience_kind
                WHEN 'COURSE' THEN COALESCE(co.name, 'Curs')
                WHEN 'ACTIVITY' THEN COALESCE(ac.name, 'Activitate')
                WHEN 'CAMP' THEN COALESCE(ca.title, 'Tabără')
                ELSE COALESCE(cl.name, 'Club')
            END
        FROM public.club_announcements a
        LEFT JOIN public.clubs cl ON cl.id = a.club_id
        LEFT JOIN public.courses co ON a.audience_kind = 'COURSE' AND co.id = a.audience_id
        LEFT JOIN public.activities ac ON a.audience_kind = 'ACTIVITY' AND ac.id = a.audience_id
        LEFT JOIN public.camps ca ON a.audience_kind = 'CAMP' AND ca.id = a.audience_id
        WHERE a.is_active AND a.created_at <= v_as_of
          AND (a.publish_at IS NULL OR a.publish_at <= v_as_of)
          AND (a.expires_at IS NULL OR a.expires_at > v_now)
          AND (p_course_id IS NULL OR (a.audience_kind = 'COURSE' AND a.audience_id = p_course_id))
          AND EXISTS (
              SELECT FROM parent_enrollments e
              WHERE public.audience_club_id(e.kind, e.entity_id) = a.club_id
                AND (a.audience_kind = 'CLUB' OR (e.kind = a.audience_kind AND e.entity_id = a.audience_id))
          )
    ), order_version AS (
        SELECT md5(COALESCE(string_agg(
            a.source || ':' || a.id::TEXT || ':' || a.pinned::INTEGER::TEXT || ':' ||
                extract(epoch FROM a.published_at)::TEXT,
            ',' ORDER BY a.source COLLATE "C", a.id
        ), '')) AS value FROM visible a
    ), bounded AS MATERIALIZED (
        SELECT * FROM visible a
        WHERE v_cursor_parts = 0 OR
            (a.pinned, a.published_at, a.source COLLATE "C", a.id)
              < (p_before_pinned, p_before_published_at, p_before_source COLLATE "C", p_before_id)
        ORDER BY a.pinned DESC, a.published_at DESC, a.source COLLATE "C" DESC, a.id DESC
        LIMIT p_page_size + 1
    ), numbered AS (
        SELECT a.*, row_number() OVER (
            ORDER BY a.pinned DESC, a.published_at DESC, a.source COLLATE "C" DESC, a.id DESC
        ) AS position FROM bounded a
    )
    SELECT jsonb_build_object(
        '_orderVersion', (SELECT value FROM order_version),
        'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'id', a.id, 'source', a.source, 'content', a.content, 'title', a.title,
            'pinned', a.pinned, 'publishedAt', a.published_at, 'authorName', a.author_name,
            'courseId', a.course_id, 'courseName', a.course_name,
            'audienceKind', a.audience_kind, 'audienceName', a.audience_name
        ) ORDER BY a.position) FROM numbered a WHERE a.position <= p_page_size), '[]'::JSONB),
        'asOf', v_as_of,
        'previousSeenAt', (SELECT last_seen_at FROM public.user_announcement_views WHERE user_id = (SELECT auth.uid())),
        'nextCursor', CASE WHEN (SELECT count(*) FROM bounded) > p_page_size THEN (
            SELECT jsonb_build_object('pinned', a.pinned, 'publishedAt', a.published_at,
                'source', a.source, 'id', a.id, 'orderVersion', (SELECT value FROM order_version))
            FROM numbered a WHERE a.position = p_page_size
        ) ELSE NULL END
    ) INTO v_result;
    IF v_cursor_parts = 4 AND p_order_version IS DISTINCT FROM v_result->>'_orderVersion' THEN
        RAISE EXCEPTION 'Announcement ordering changed; reload the list' USING ERRCODE = 'PT409';
    END IF;
    RETURN v_result - '_orderVersion';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_parent_announcement_courses()
RETURNS TABLE (id UUID, name TEXT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT co.id, co.name
    FROM public.courses co
    WHERE EXISTS (
        SELECT FROM public.enrollments e
        JOIN public.children ch ON ch.id = e.child_id
        WHERE ch.parent_id = (SELECT auth.uid()) AND e.status = 'ACTIVE'
          AND e.kind = 'COURSE' AND e.entity_id = co.id
    )
    ORDER BY co.name, co.id;
$$;

CREATE OR REPLACE FUNCTION public.clamp_parent_announcement_visit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF NEW.last_seen_at IS NULL OR NOT isfinite(NEW.last_seen_at) THEN
        RAISE EXCEPTION 'Invalid announcement visit timestamp' USING ERRCODE = '22023';
    END IF;
    NEW.last_seen_at := LEAST(NEW.last_seen_at, statement_timestamp());
    IF TG_OP = 'UPDATE' THEN
        NEW.last_seen_at := GREATEST(OLD.last_seen_at, NEW.last_seen_at);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER clamp_parent_announcement_visit
    BEFORE INSERT OR UPDATE ON public.user_announcement_views
    FOR EACH ROW EXECUTE FUNCTION public.clamp_parent_announcement_visit();

CREATE OR REPLACE FUNCTION public.mark_parent_announcements_seen(p_as_of TIMESTAMPTZ, p_expected_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF p_expected_user_id IS NULL OR (SELECT auth.uid()) IS DISTINCT FROM p_expected_user_id THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;
    IF p_as_of IS NULL OR NOT isfinite(p_as_of) THEN
        RAISE EXCEPTION 'Invalid announcement visit timestamp' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.user_announcement_views (user_id, last_seen_at)
    VALUES ((SELECT auth.uid()), LEAST(p_as_of, statement_timestamp()))
    ON CONFLICT (user_id) DO UPDATE
        SET last_seen_at = GREATEST(public.user_announcement_views.last_seen_at, EXCLUDED.last_seen_at);
END;
$$;

CREATE INDEX course_announcements_parent_feed_idx
    ON public.course_announcements (course_id, pinned DESC, created_at DESC, id DESC);
CREATE INDEX club_announcements_parent_feed_idx
    ON public.club_announcements (audience_kind, audience_id, (GREATEST(created_at, publish_at)) DESC, id DESC)
    WHERE is_active;

ALTER POLICY course_announcements_insert ON public.course_announcements
    WITH CHECK (
        author_user_id = (SELECT auth.uid())
        AND (
            course_id IN (SELECT c.id FROM public.courses c WHERE c.coach_id = (SELECT auth.uid()))
            OR (SELECT public.get_my_role()) = 'ADMIN'
        )
    );

CREATE OR REPLACE FUNCTION public.preserve_course_announcement_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF NEW.author_user_id IS DISTINCT FROM OLD.author_user_id OR NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Announcement author and identity cannot be changed' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER preserve_course_announcement_identity
    BEFORE UPDATE ON public.course_announcements
    FOR EACH ROW EXECUTE FUNCTION public.preserve_course_announcement_identity();

REVOKE ALL ON FUNCTION public.get_parent_announcement_feed(UUID, TIMESTAMPTZ, BOOLEAN, TIMESTAMPTZ, TEXT, UUID, INTEGER, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_parent_announcement_courses() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_parent_announcements_seen(TIMESTAMPTZ, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clamp_parent_announcement_visit() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.preserve_course_announcement_identity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_parent_announcement_feed(UUID, TIMESTAMPTZ, BOOLEAN, TIMESTAMPTZ, TEXT, UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_announcement_courses() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_parent_announcements_seen(TIMESTAMPTZ, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
