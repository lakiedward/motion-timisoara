DROP POLICY IF EXISTS "activity_photos_coach_insert" ON storage.objects;
CREATE POLICY "activity_photos_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'activity-photos'
        AND public.get_my_role() IN ('COACH', 'CLUB', 'ADMIN')
    );

DROP POLICY IF EXISTS "activity_photos_coach_delete" ON storage.objects;
CREATE POLICY "activity_photos_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'activity-photos'
        AND public.get_my_role() IN ('COACH', 'CLUB', 'ADMIN')
    );
