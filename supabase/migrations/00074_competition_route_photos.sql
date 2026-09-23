CREATE TABLE public.competition_route_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL,
    route_id UUID NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT competition_route_photos_route_fk FOREIGN KEY (competition_id, route_id)
        REFERENCES public.competition_routes (competition_id, id) ON DELETE CASCADE,
    CONSTRAINT competition_route_photos_display_order_ck CHECK (display_order >= 0),
    CONSTRAINT competition_route_photos_storage_path_ck CHECK (
        storage_path ~ (
            '^' || competition_id::TEXT || '/routes/' || route_id::TEXT ||
            '/gallery/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
        )
    )
);

CREATE INDEX competition_route_photos_order_idx
    ON public.competition_route_photos (competition_id, route_id, display_order, id);

CREATE FUNCTION public.guard_competition_route_photo_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'INSERT'
        OR NEW.competition_id IS DISTINCT FROM OLD.competition_id
        OR NEW.route_id IS DISTINCT FROM OLD.route_id THEN
        PERFORM 1
        FROM public.competition_routes route
        WHERE route.competition_id = NEW.competition_id
          AND route.id = NEW.route_id
        FOR NO KEY UPDATE;

        IF (SELECT count(*)
            FROM public.competition_route_photos photo
            WHERE photo.competition_id = NEW.competition_id
              AND photo.route_id = NEW.route_id) >= 12 THEN
            RAISE EXCEPTION 'Un traseu poate avea cel mult 12 fotografii'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_competition_route_photo_limit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER competition_route_photos_limit
    BEFORE INSERT OR UPDATE OF competition_id, route_id ON public.competition_route_photos
    FOR EACH ROW EXECUTE FUNCTION public.guard_competition_route_photo_limit();

ALTER TABLE public.competition_route_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.competition_route_photos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.competition_route_photos TO anon, authenticated;
GRANT INSERT (id, competition_id, route_id, storage_path, display_order)
    ON public.competition_route_photos TO authenticated;
GRANT UPDATE (display_order) ON public.competition_route_photos TO authenticated;
GRANT DELETE ON public.competition_route_photos TO authenticated;

CREATE POLICY competition_route_photos_select ON public.competition_route_photos
    FOR SELECT TO anon, authenticated
    USING (competition_id IN (SELECT id FROM public.competitions));

CREATE POLICY competition_route_photos_insert ON public.competition_route_photos
    FOR INSERT TO authenticated
    WITH CHECK (public.pot_administra_concurs(competition_id));

CREATE POLICY competition_route_photos_update ON public.competition_route_photos
    FOR UPDATE TO authenticated
    USING (public.pot_administra_concurs(competition_id))
    WITH CHECK (public.pot_administra_concurs(competition_id));

CREATE POLICY competition_route_photos_delete ON public.competition_route_photos
    FOR DELETE TO authenticated
    USING (public.pot_administra_concurs(competition_id));

CREATE FUNCTION public.can_upload_competition_photo(p_path TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.pot_administra_concurs(public.safe_uuid(split_part(p_path, '/', 1)))
        AND (
            p_path ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/hero/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.jpg$'
            OR (
                p_path ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/routes/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/gallery/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(jpg|png|webp)$'
                AND EXISTS (
                    SELECT 1 FROM public.competition_routes route
                    WHERE route.competition_id = public.safe_uuid(split_part(p_path, '/', 1))
                      AND route.id = public.safe_uuid(split_part(p_path, '/', 3))
                )
            )
        )
$$;

REVOKE ALL ON FUNCTION public.can_upload_competition_photo(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_upload_competition_photo(TEXT) TO authenticated;

DROP POLICY competition_photos_owner_insert ON storage.objects;
CREATE POLICY competition_photos_owner_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'competition-photos'
        AND public.can_upload_competition_photo(name)
    );
