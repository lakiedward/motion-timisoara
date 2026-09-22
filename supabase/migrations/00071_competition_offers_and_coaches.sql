CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

ALTER TABLE public.competitions
    ADD COLUMN start_at TIMESTAMPTZ,
    ADD COLUMN end_at TIMESTAMPTZ,
    ADD COLUMN registration_deadline_at TIMESTAMPTZ,
    ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    ADD COLUMN location_text TEXT,
    ADD COLUMN allow_cash BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.competitions
    ADD CONSTRAINT competitions_event_details_ck CHECK (
        start_at IS NOT NULL
        AND end_at IS NOT NULL
        AND registration_deadline_at IS NOT NULL
        AND registration_deadline_at <= start_at
        AND start_at < end_at
        AND location_text IS NOT NULL
        AND char_length(btrim(location_text)) BETWEEN 1 AND 240
    ) NOT VALID;

CREATE INDEX competitions_start_at_idx ON public.competitions (start_at);
CREATE INDEX competitions_location_idx ON public.competitions (location_id);

COMMENT ON CONSTRAINT competitions_event_details_ck ON public.competitions IS
    'Existing skeleton rows remain readable. Their next update must supply full schedule and location; every new row must supply them.';

CREATE TABLE public.competition_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    gpx_storage_path TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT competition_routes_competition_id_id_key UNIQUE (competition_id, id),
    CONSTRAINT competition_routes_name_ck CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
    CONSTRAINT competition_routes_description_ck CHECK (char_length(btrim(description)) BETWEEN 1 AND 4000),
    CONSTRAINT competition_routes_display_order_ck CHECK (display_order >= 0),
    CONSTRAINT competition_routes_gpx_path_ck CHECK (
        gpx_storage_path IS NULL OR gpx_storage_path ~ (
            '^' || competition_id::TEXT || '/routes/' || id::TEXT ||
            '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.gpx$'
        )
    )
);

CREATE INDEX competition_routes_order_idx
    ON public.competition_routes (competition_id, display_order, id);

CREATE TRIGGER competition_routes_set_updated_at
    BEFORE UPDATE ON public.competition_routes
    FOR EACH ROW
    EXECUTE FUNCTION public.competitions_set_updated_at();

ALTER TABLE public.competition_routes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.competition_routes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.competition_routes TO anon, authenticated;
GRANT INSERT (id, competition_id, name, description, gpx_storage_path, display_order)
    ON public.competition_routes TO authenticated;
GRANT UPDATE (name, description, gpx_storage_path, display_order)
    ON public.competition_routes TO authenticated;
GRANT DELETE ON public.competition_routes TO authenticated;

CREATE POLICY competition_routes_select ON public.competition_routes
    FOR SELECT TO anon, authenticated
    USING (competition_id IN (SELECT id FROM public.competitions));

CREATE POLICY competition_routes_insert ON public.competition_routes
    FOR INSERT TO authenticated
    WITH CHECK (public.pot_administra_concurs(competition_id));

CREATE POLICY competition_routes_update ON public.competition_routes
    FOR UPDATE TO authenticated
    USING (public.pot_administra_concurs(competition_id))
    WITH CHECK (public.pot_administra_concurs(competition_id));

CREATE POLICY competition_routes_delete ON public.competition_routes
    FOR DELETE TO authenticated
    USING (public.pot_administra_concurs(competition_id));

SET search_path = public, extensions, pg_catalog;

CREATE TABLE public.competition_age_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
    route_id UUID NOT NULL,
    name TEXT NOT NULL,
    age_from INTEGER NOT NULL,
    age_to INTEGER NOT NULL,
    price_bani BIGINT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT competition_age_categories_id_competition_id_key UNIQUE (id, competition_id),
    CONSTRAINT competition_age_categories_route_fk FOREIGN KEY (competition_id, route_id)
        REFERENCES public.competition_routes (competition_id, id)
        ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT competition_age_categories_name_ck CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
    CONSTRAINT competition_age_categories_age_ck CHECK (
        age_from BETWEEN 0 AND 120 AND age_to BETWEEN age_from AND 120
    ),
    CONSTRAINT competition_age_categories_price_ck CHECK (
        price_bani BETWEEN 0 AND 99999999
    ),
    CONSTRAINT competition_age_categories_display_order_ck CHECK (display_order >= 0),
    CONSTRAINT competition_age_categories_no_overlap EXCLUDE USING gist (
        competition_id WITH =,
        int4range(age_from, age_to, '[]') WITH &&
    ) DEFERRABLE INITIALLY IMMEDIATE
);

RESET search_path;

CREATE INDEX competition_age_categories_order_idx
    ON public.competition_age_categories (competition_id, display_order, id);
CREATE INDEX competition_age_categories_route_idx
    ON public.competition_age_categories (competition_id, route_id);

CREATE TRIGGER competition_age_categories_set_updated_at
    BEFORE UPDATE ON public.competition_age_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.competitions_set_updated_at();

ALTER TABLE public.competition_age_categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.competition_age_categories FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.competition_age_categories TO anon, authenticated;
GRANT INSERT (id, competition_id, route_id, name, age_from, age_to, price_bani, display_order)
    ON public.competition_age_categories TO authenticated;
GRANT UPDATE (route_id, name, age_from, age_to, price_bani, display_order)
    ON public.competition_age_categories TO authenticated;
GRANT DELETE ON public.competition_age_categories TO authenticated;

CREATE POLICY competition_age_categories_select ON public.competition_age_categories
    FOR SELECT TO anon, authenticated
    USING (competition_id IN (SELECT id FROM public.competitions));

CREATE POLICY competition_age_categories_insert ON public.competition_age_categories
    FOR INSERT TO authenticated
    WITH CHECK (public.pot_administra_concurs(competition_id));

CREATE POLICY competition_age_categories_update ON public.competition_age_categories
    FOR UPDATE TO authenticated
    USING (public.pot_administra_concurs(competition_id))
    WITH CHECK (public.pot_administra_concurs(competition_id));

CREATE POLICY competition_age_categories_delete ON public.competition_age_categories
    FOR DELETE TO authenticated
    USING (public.pot_administra_concurs(competition_id));

CREATE TABLE public.competition_coaches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
    coach_profile_id UUID NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'invited',
    invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at TIMESTAMPTZ,
    CONSTRAINT competition_coaches_unique UNIQUE (competition_id, coach_profile_id),
    CONSTRAINT competition_coaches_status_ck CHECK (status IN ('invited', 'accepted', 'declined')),
    CONSTRAINT competition_coaches_response_ck CHECK (
        (status = 'invited' AND responded_at IS NULL)
        OR (status IN ('accepted', 'declined') AND responded_at IS NOT NULL)
    )
);

CREATE INDEX competition_coaches_coach_idx
    ON public.competition_coaches (coach_profile_id, status);

ALTER TABLE public.competition_coaches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.competition_coaches FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.competition_coaches TO anon, authenticated;
GRANT INSERT (competition_id, coach_profile_id) ON public.competition_coaches TO authenticated;
GRANT DELETE ON public.competition_coaches TO authenticated;

CREATE POLICY competition_coaches_public_select ON public.competition_coaches
    FOR SELECT TO anon
    USING (status = 'accepted');

CREATE POLICY competition_coaches_authenticated_select ON public.competition_coaches
    FOR SELECT TO authenticated
    USING (
        status = 'accepted'
        OR public.pot_administra_concurs(competition_id)
        OR coach_profile_id IN (
            SELECT id FROM public.coach_profiles WHERE user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY competition_coaches_insert ON public.competition_coaches
    FOR INSERT TO authenticated
    WITH CHECK (
        public.pot_administra_concurs(competition_id)
        AND status = 'invited'
        AND responded_at IS NULL
    );

CREATE POLICY competition_coaches_delete ON public.competition_coaches
    FOR DELETE TO authenticated
    USING (public.pot_administra_concurs(competition_id));

CREATE OR REPLACE FUNCTION public.respond_to_competition_invitation(
    p_competition_id UUID,
    p_accept BOOLEAN
)
RETURNS public.competition_coaches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    invitation public.competition_coaches;
BEGIN
    IF (SELECT auth.uid()) IS NULL OR p_accept IS NULL THEN
        RAISE EXCEPTION 'Invitatia necesita un antrenor autentificat si un raspuns'
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.competition_coaches AS cc
    SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
        responded_at = now()
    WHERE cc.competition_id = p_competition_id
      AND cc.status = 'invited'
      AND cc.coach_profile_id IN (
          SELECT cp.id FROM public.coach_profiles AS cp
          WHERE cp.user_id = (SELECT auth.uid())
      )
    RETURNING * INTO invitation;

    IF invitation IS NULL THEN
        RAISE EXCEPTION 'Nu exista o invitatie activa pentru acest concurs'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN invitation;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_competition_invitation(UUID, BOOLEAN)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_competition_invitation(UUID, BOOLEAN)
    TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'competition-routes',
    'competition-routes',
    TRUE,
    2097152,
    ARRAY['application/gpx+xml', 'application/xml', 'text/xml']::TEXT[]
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY competition_routes_storage_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'competition-routes'
        AND public.pot_administra_concurs(public.safe_uuid((storage.foldername(name))[1]))
    );

CREATE POLICY competition_routes_storage_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'competition-routes'
        AND name ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/routes/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.gpx$'
        AND public.pot_administra_concurs(public.safe_uuid((storage.foldername(name))[1]))
        AND EXISTS (
            SELECT 1 FROM public.competition_routes AS route
            WHERE route.id = public.safe_uuid((storage.foldername(name))[3])
              AND route.competition_id = public.safe_uuid((storage.foldername(name))[1])
        )
    );

CREATE POLICY competition_routes_storage_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'competition-routes'
        AND public.pot_administra_concurs(public.safe_uuid((storage.foldername(name))[1]))
    );
