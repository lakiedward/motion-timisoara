DROP POLICY IF EXISTS "club_announcements_select" ON public.club_announcements;

CREATE POLICY "club_announcements_select" ON public.club_announcements
    FOR SELECT TO authenticated
    USING (
        club_id IN (SELECT my_club_ids())
        OR (SELECT get_my_role()) = 'ADMIN'
        OR (
            is_active = TRUE
            AND (publish_at IS NULL OR publish_at <= now())
            AND (expires_at IS NULL OR expires_at > now())
            AND (
                (
                    audience_kind = 'COURSE'
                    AND EXISTS (
                        SELECT 1
                        FROM public.courses c
                        WHERE c.id = club_announcements.audience_id
                          AND c.club_id = club_announcements.club_id
                          AND c.coach_id = (SELECT auth.uid())
                    )
                )
                OR CASE
                    WHEN audience_kind = 'CLUB' THEN EXISTS (
                        SELECT 1
                        FROM public.enrollments e
                        JOIN public.children ch ON ch.id = e.child_id
                        WHERE ch.parent_id = (SELECT auth.uid())
                          AND e.status = 'ACTIVE'
                          AND public.audience_club_id(e.kind, e.entity_id)
                              = club_announcements.club_id
                    )
                    ELSE (
                        public.audience_club_id(audience_kind, audience_id)
                            = club_announcements.club_id
                        AND EXISTS (
                            SELECT 1
                            FROM public.enrollments e
                            JOIN public.children ch ON ch.id = e.child_id
                            WHERE ch.parent_id = (SELECT auth.uid())
                              AND e.status = 'ACTIVE'
                              AND e.kind = club_announcements.audience_kind
                              AND e.entity_id = club_announcements.audience_id
                        )
                    )
                END
            )
        )
    );
