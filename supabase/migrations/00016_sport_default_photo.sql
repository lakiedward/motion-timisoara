ALTER TABLE public.sports
  ADD COLUMN IF NOT EXISTS default_photo_storage_path text;

COMMENT ON COLUMN public.sports.default_photo_storage_path IS
  'Storage path in sport-photos bucket; shown on every course of this sport without its own photo.';

INSERT INTO storage.buckets (id, name, public)
VALUES ('sport-photos', 'sport-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "sport_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "sport_photos_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "sport_photos_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "sport_photos_admin_delete" ON storage.objects;

CREATE POLICY "sport_photos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'sport-photos');

CREATE POLICY "sport_photos_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sport-photos'
    AND (select public.get_my_role()) = 'ADMIN'
  );

CREATE POLICY "sport_photos_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'sport-photos'
    AND (select public.get_my_role()) = 'ADMIN'
  );

CREATE POLICY "sport_photos_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'sport-photos'
    AND (select public.get_my_role()) = 'ADMIN'
  );
