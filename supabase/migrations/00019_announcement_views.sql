CREATE TABLE IF NOT EXISTS public.user_announcement_views (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_announcement_views IS 'When each user last opened their announcements page. Used to mark newer announcements as unseen.';

ALTER TABLE public.user_announcement_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_announcement_views_select ON public.user_announcement_views
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY user_announcement_views_insert ON public.user_announcement_views
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY user_announcement_views_update ON public.user_announcement_views
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.user_announcement_views TO authenticated;
