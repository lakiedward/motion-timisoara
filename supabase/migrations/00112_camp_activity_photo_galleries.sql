-- Galerii ca la cursuri pentru tabere și activități (proprietarul, 2026-11-02).
--
-- 00111 a dat galeriei de curs descrieri scurte și dovada acordului părinților.
-- Aici aceeași regulă ajunge la:
--
-- * `camp_photos` (din 00025, RLS prin `pot_administra_tabara`): primește
--   `caption`, `consent_confirmed_at`, `uploaded_by` și trigger-ul care refuză
--   o poză nouă fără bifă. Rândurile vechi rămân cu acordul NULL: nu inventăm
--   un acord care nu a fost dat; regula se aplică doar la INSERT.
-- * `activity_photos`, tabel nou: o activitate avea până acum doar poza hero.
--   Fișierele stau în bucketul public `activity-photos`, în folderul
--   `{activity_id}/gallery/`, deja acoperit de politicile din 00090
--   (`pot_administra_activitate`). Citirea urmează vizibilitatea activității,
--   ca la tabere; scrierea e pentru cine administrează activitatea.

ALTER TABLE public.camp_photos
    ADD COLUMN caption text,
    ADD COLUMN consent_confirmed_at timestamptz,
    ADD COLUMN uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.camp_photos
    ADD CONSTRAINT camp_photos_caption_length
    CHECK (caption IS NULL OR char_length(caption) <= 60);

CREATE TABLE public.activity_photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    storage_path text NOT NULL UNIQUE,
    display_order integer NOT NULL DEFAULT 0,
    caption text,
    consent_confirmed_at timestamptz,
    uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT activity_photos_display_order_ck CHECK (display_order >= 0),
    CONSTRAINT activity_photos_caption_length CHECK (caption IS NULL OR char_length(caption) <= 60),
    CONSTRAINT activity_photos_storage_path_ck CHECK (
        storage_path ~ ('^' || activity_id::text || '/gallery/[0-9a-f-]{36}\.jpg$')
    )
);

CREATE INDEX activity_photos_activity_idx
    ON public.activity_photos (activity_id, display_order);

ALTER TABLE public.activity_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_photos_select" ON public.activity_photos
    FOR SELECT TO anon, authenticated
    USING (activity_id IN (SELECT id FROM public.activities));

CREATE POLICY "activity_photos_write" ON public.activity_photos
    FOR ALL TO authenticated
    USING (public.pot_administra_activitate(activity_id))
    WITH CHECK (public.pot_administra_activitate(activity_id));

REVOKE ALL ON public.activity_photos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.activity_photos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.activity_photos TO authenticated;

CREATE OR REPLACE FUNCTION public.gallery_photos_require_consent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.consent_confirmed_at IS NULL THEN
        RAISE EXCEPTION 'Confirmă că ai acordul părinților pentru copiii din poze.'
            USING ERRCODE = '23514', HINT = 'gallery_photo_consent_required';
    END IF;
    NEW.consent_confirmed_at := now();
    NEW.uploaded_by := auth.uid();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gallery_photos_require_consent() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER camp_photos_require_consent
    BEFORE INSERT ON public.camp_photos
    FOR EACH ROW EXECUTE FUNCTION public.gallery_photos_require_consent();

CREATE TRIGGER activity_photos_require_consent
    BEFORE INSERT ON public.activity_photos
    FOR EACH ROW EXECUTE FUNCTION public.gallery_photos_require_consent();
