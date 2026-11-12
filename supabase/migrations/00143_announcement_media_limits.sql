-- Limite pentru bucket-ul `announcement-media` (pozele și filmările din anunțuri).
--
-- Bucket-ul e privat, dar nu avea limită de tip sau mărime: un cont care avea
-- voie să urce (antrenorul cursului, clubul, ADMIN) putea pune orice fișier,
-- inclusiv SVG sau HTML, până la limita globală a proiectului. Tipul și mărimea
-- erau verificate doar în aplicație (`src/lib/media.ts`).
--
-- Limitele urmează regulile pe care aplicația le aplică deja:
-- - pozele sunt micșorate și recomprimate JPEG în browser; trec JPEG, PNG, WebP
--   și GIF, la fel ca la bucket-urile de poze din 00141, fără SVG, HTML sau HEIC;
-- - filmările au cel mult 50 MB (decizia proprietarului din 2026-08-26, același
--   prag ca `MAX_FILM_MB`); trec MP4 (Android, desktop), MOV (iPhone) și WebM.
-- Limita de 50 MiB acoperă și pozele, care ajung la sub 1 MB după micșorare.
--
-- Cine poate urca rămâne cum a stabilit 00141: un cont activ care e antrenorul
-- cursului anunțului, clubul care a publicat anunțul, sau ADMIN. Citirea rămâne
-- legată de vizibilitatea anunțului (00023, 00097). Nu există politică UPDATE,
-- deci un fișier urcat nu poate fi înlocuit pe loc.
--
-- Limitele se aplică doar fișierelor noi. La 2026-11-12 bucket-ul era gol
-- (0 fișiere, 0 rânduri în `announcement_attachments`).
--
-- Migrația se oprește dacă bucket-ul lipsește, a devenit public, are deja limite
-- sau dacă politicile de scriere din 00141 nu mai există.

DO $$
DECLARE
  v_bucket storage.buckets%ROWTYPE;
  v_missing TEXT;
BEGIN
  SELECT * INTO v_bucket FROM storage.buckets WHERE id = 'announcement-media';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bucket-ul announcement-media lipsește; verifică storage.buckets înainte de 00143';
  END IF;
  IF v_bucket.public THEN
    RAISE EXCEPTION 'Bucket-ul announcement-media a devenit public; verifică înainte de 00143';
  END IF;
  IF v_bucket.file_size_limit IS NOT NULL OR v_bucket.allowed_mime_types IS NOT NULL THEN
    RAISE EXCEPTION 'Bucket-ul announcement-media are deja limite; verifică storage.buckets înainte de 00143';
  END IF;

  SELECT string_agg(expected.policyname, ', ') INTO v_missing
  FROM (VALUES
    ('announcement_media_owner_insert'), ('announcement_media_owner_delete'),
    ('announcement_media_read')
  ) AS expected(policyname)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
      AND p.policyname = expected.policyname
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Politici lipsă pe storage.objects: %; verifică starea live înainte de 00143', v_missing;
  END IF;
END $$;

UPDATE storage.buckets
SET file_size_limit = 52428800,
    allowed_mime_types = ARRAY[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/quicktime', 'video/webm'
    ]
WHERE id = 'announcement-media';
