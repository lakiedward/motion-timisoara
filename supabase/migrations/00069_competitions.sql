-- To-Do #153, felia acceptată pe 2026-09-22: prezentarea unui concurs.
-- Nume, descriere și o poză hero opțională. Fără traseu, categorie, înscriere,
-- plată sau podium. Un concurs salvat este public imediat, ca o tabără.

CREATE TABLE public.competitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    hero_photo_storage_path TEXT,
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT competitions_title_ck CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
    CONSTRAINT competitions_description_ck CHECK (char_length(btrim(description)) BETWEEN 1 AND 4000),
    CONSTRAINT competitions_slug_ck CHECK (
        char_length(slug) BETWEEN 1 AND 60
        AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    ),
    CONSTRAINT competitions_owner_ck CHECK (num_nonnulls(club_id, coach_id) <= 1),
    CONSTRAINT competitions_hero_path_ck CHECK (
        hero_photo_storage_path IS NULL
        OR hero_photo_storage_path ~ (
            '^' || id::text || '/hero/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
        )
    )
);

COMMENT ON TABLE public.competitions IS
    'Concurs public. Exact un proprietar club sau antrenor, ori niciunul cand il creeaza adminul.';
COMMENT ON COLUMN public.competitions.club_id IS
    'Clubul care a creat concursul. Nu poate sta langa coach_id.';
COMMENT ON COLUMN public.competitions.coach_id IS
    'Antrenorul care a creat concursul. Nu poate sta langa club_id.';

CREATE INDEX competitions_club_idx ON public.competitions (club_id);
CREATE INDEX competitions_coach_idx ON public.competitions (coach_id);

CREATE OR REPLACE FUNCTION public.competitions_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER competitions_set_updated_at
    BEFORE UPDATE ON public.competitions
    FOR EACH ROW
    EXECUTE FUNCTION public.competitions_set_updated_at();

CREATE OR REPLACE FUNCTION public.pot_administra_concurs(p_competition_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.competitions c
        WHERE c.id = p_competition_id
          AND (
              c.club_id IN (SELECT public.my_club_ids())
              OR c.coach_id = (SELECT auth.uid())
          )
    ) OR (SELECT public.get_my_role()) = 'ADMIN'
$$;

REVOKE ALL ON FUNCTION public.pot_administra_concurs(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pot_administra_concurs(UUID) TO authenticated;

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "competitions_select" ON public.competitions
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "competitions_insert" ON public.competitions
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT public.get_my_role()) = 'ADMIN'
        OR (
            club_id IN (SELECT public.my_club_ids())
            AND coach_id IS NULL
            AND (SELECT public.get_my_role()) = 'CLUB'
        )
        OR (
            coach_id = (SELECT auth.uid())
            AND club_id IS NULL
            AND (SELECT public.get_my_role()) = 'COACH'
        )
    );

CREATE POLICY "competitions_update" ON public.competitions
    FOR UPDATE TO authenticated
    USING (public.pot_administra_concurs(id))
    WITH CHECK (
        club_id IN (SELECT public.my_club_ids())
        OR coach_id = (SELECT auth.uid())
        OR (SELECT public.get_my_role()) = 'ADMIN'
    );

CREATE POLICY "competitions_delete" ON public.competitions
    FOR DELETE TO authenticated
    USING (public.pot_administra_concurs(id));

GRANT SELECT ON public.competitions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.competitions TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('competition-photos', 'competition-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "competition_photos_owner_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'competition-photos'
        AND public.pot_administra_concurs(public.safe_uuid((storage.foldername(name))[1]))
    );

CREATE POLICY "competition_photos_owner_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'competition-photos'
        AND public.pot_administra_concurs(public.safe_uuid((storage.foldername(name))[1]))
    );

CREATE POLICY "competition_photos_owner_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'competition-photos'
        AND public.pot_administra_concurs(public.safe_uuid((storage.foldername(name))[1]))
    );
