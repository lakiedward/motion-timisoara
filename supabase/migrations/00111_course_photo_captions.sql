-- Galeria cursului „O zi la curs” (cererea proprietarului din 2026-11-02).
--
-- `course_photos` există din 00001, cu RLS din 00011 (citire publică, scriere
-- pentru antrenorul cursului, clubul proprietar și ADMIN) și cu politicile de
-- storage din 00090 pe folderul `{course_id}/`. Migrarea adaugă doar:
--
-- * `caption`: o descriere scurtă a pozei („Încălzirea pe mal”), cel mult 60
--   de caractere, afișată peste poză în mozaicul public;
-- * `consent_confirmed_at` / `uploaded_by`: dovada că cine a încărcat poza a
--   bifat că are acordul scris al părinților copiilor din ea. Trigger-ul
--   refuză o poză nouă fără bifă și pune el ora serverului și utilizatorul,
--   ca valorile să nu poată fi trimise din client.
--
-- Rândurile vechi (unul singur la aplicare) rămân cu `consent_confirmed_at`
-- NULL: nu inventăm un acord care nu a fost dat. Regula se aplică la INSERT,
-- deci descrierea lor se poate edita în continuare.

ALTER TABLE public.course_photos
    ADD COLUMN caption text,
    ADD COLUMN consent_confirmed_at timestamptz,
    ADD COLUMN uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.course_photos
    ADD CONSTRAINT course_photos_caption_length
    CHECK (caption IS NULL OR char_length(caption) <= 60);

CREATE OR REPLACE FUNCTION public.course_photos_require_consent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.consent_confirmed_at IS NULL THEN
        RAISE EXCEPTION 'Confirmă că ai acordul părinților pentru copiii din poze.'
            USING ERRCODE = '23514', HINT = 'course_photo_consent_required';
    END IF;
    NEW.consent_confirmed_at := now();
    NEW.uploaded_by := auth.uid();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.course_photos_require_consent() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER course_photos_require_consent
    BEFORE INSERT ON public.course_photos
    FOR EACH ROW EXECUTE FUNCTION public.course_photos_require_consent();
