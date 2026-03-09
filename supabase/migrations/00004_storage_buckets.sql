-- ============================================================
-- Supabase Storage Buckets & Policies
-- ============================================================

-- Create buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('course-photos', 'course-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('coach-photos', 'coach-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('club-assets', 'club-assets', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('activity-photos', 'activity-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('announcement-media', 'announcement-media', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('child-photos', 'child-photos', false);

-- =====================
-- COURSE-PHOTOS: public read, coach/club/admin write
-- Path: course-photos/{course_id}/hero/{uuid}.{ext}
-- Path: course-photos/{course_id}/gallery/{uuid}.{ext}
-- =====================
CREATE POLICY "course_photos_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'course-photos');

CREATE POLICY "course_photos_coach_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'course-photos'
        AND public.get_my_role() IN ('COACH', 'ADMIN', 'CLUB')
    );

CREATE POLICY "course_photos_coach_update" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'course-photos'
        AND public.get_my_role() IN ('COACH', 'ADMIN', 'CLUB')
    );

CREATE POLICY "course_photos_coach_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'course-photos'
        AND public.get_my_role() IN ('COACH', 'ADMIN', 'CLUB')
    );

-- =====================
-- COACH-PHOTOS: public read, owner write (path scoped to user_id)
-- Path: coach-photos/{user_id}/{uuid}.{ext}
-- =====================
CREATE POLICY "coach_photos_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'coach-photos');

CREATE POLICY "coach_photos_owner_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'coach-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "coach_photos_owner_update" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'coach-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "coach_photos_owner_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'coach-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "coach_photos_admin_all" ON storage.objects
    FOR ALL USING (
        bucket_id = 'coach-photos'
        AND public.get_my_role() = 'ADMIN'
    );

-- =====================
-- CLUB-ASSETS: public read, club owner/admin write
-- Path: club-assets/{club_id}/logo/{uuid}.{ext}
-- Path: club-assets/{club_id}/hero/{uuid}.{ext}
-- =====================
CREATE POLICY "club_assets_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'club-assets');

CREATE POLICY "club_assets_owner_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'club-assets'
        AND public.get_my_role() IN ('CLUB', 'ADMIN')
    );

CREATE POLICY "club_assets_owner_update" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'club-assets'
        AND public.get_my_role() IN ('CLUB', 'ADMIN')
    );

CREATE POLICY "club_assets_owner_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'club-assets'
        AND public.get_my_role() IN ('CLUB', 'ADMIN')
    );

-- =====================
-- ACTIVITY-PHOTOS: public read, coach/admin write
-- Path: activity-photos/{activity_id}/hero/{uuid}.{ext}
-- =====================
CREATE POLICY "activity_photos_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'activity-photos');

CREATE POLICY "activity_photos_coach_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'activity-photos'
        AND public.get_my_role() IN ('COACH', 'ADMIN')
    );

CREATE POLICY "activity_photos_coach_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'activity-photos'
        AND public.get_my_role() IN ('COACH', 'ADMIN')
    );

-- =====================
-- ANNOUNCEMENT-MEDIA: authenticated read, coach/admin write
-- Path: announcement-media/{announcement_id}/{uuid}.{ext}
-- =====================
CREATE POLICY "announcement_media_auth_read" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'announcement-media'
        AND auth.uid() IS NOT NULL
    );

CREATE POLICY "announcement_media_coach_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'announcement-media'
        AND public.get_my_role() IN ('COACH', 'ADMIN')
    );

CREATE POLICY "announcement_media_coach_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'announcement-media'
        AND public.get_my_role() IN ('COACH', 'ADMIN')
    );

-- =====================
-- CHILD-PHOTOS: parent read/write own (path scoped to parent_id)
-- Path: child-photos/{parent_id}/{child_id}/{uuid}.{ext}
-- =====================
CREATE POLICY "child_photos_parent_all" ON storage.objects
    FOR ALL USING (
        bucket_id = 'child-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "child_photos_admin_all" ON storage.objects
    FOR ALL USING (
        bucket_id = 'child-photos'
        AND public.get_my_role() = 'ADMIN'
    );
