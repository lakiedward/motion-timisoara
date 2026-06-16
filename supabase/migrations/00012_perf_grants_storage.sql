-- ============================================================
-- Phase 9 hardening (part 2): performance + data-exposure + storage.
--
--   A. Covering indexes for the 19 unindexed foreign keys (advisor lint 0001).
--   B. Restrict anonymous column access on profiles / coach_profiles / clubs so
--      the public (anon) role can no longer scrape emails, phones, Stripe IDs,
--      tax numbers, or bank accounts. Public pages only ever read the safe
--      display columns, so this is transparent to the app.
--   C. Drop the broad public-read SELECT policies on the four public storage
--      buckets (advisor lint 0025): public objects are still served by URL, but
--      clients can no longer LIST every file in the bucket. The app only ever
--      builds public URLs (getPublicUrl), never lists.
-- ============================================================

-- ------------------------------------------------------------
-- A. Foreign-key covering indexes
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_activities_location_id ON public.activities (location_id);
CREATE INDEX IF NOT EXISTS idx_activities_sport_id ON public.activities (sport_id);
CREATE INDEX IF NOT EXISTS idx_attendance_child_id ON public.attendance (child_id);
CREATE INDEX IF NOT EXISTS idx_club_announcements_author_user_id ON public.club_announcements (author_user_id);
CREATE INDEX IF NOT EXISTS idx_club_coaches_coach_profile_id ON public.club_coaches (coach_profile_id);
CREATE INDEX IF NOT EXISTS idx_club_invitation_codes_club_id ON public.club_invitation_codes (club_id);
CREATE INDEX IF NOT EXISTS idx_club_invitation_codes_created_by_user_id ON public.club_invitation_codes (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_club_sports_sport_id ON public.club_sports (sport_id);
CREATE INDEX IF NOT EXISTS idx_coach_invitation_codes_created_by_admin_id ON public.coach_invitation_codes (created_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_coach_invitation_codes_used_by_user_id ON public.coach_invitation_codes (used_by_user_id);
CREATE INDEX IF NOT EXISTS idx_coach_ratings_parent_id ON public.coach_ratings (parent_id);
CREATE INDEX IF NOT EXISTS idx_coach_sports_sport_id ON public.coach_sports (sport_id);
CREATE INDEX IF NOT EXISTS idx_course_announcements_author_user_id ON public.course_announcements (author_user_id);
CREATE INDEX IF NOT EXISTS idx_course_ratings_parent_id ON public.course_ratings (parent_id);
CREATE INDEX IF NOT EXISTS idx_courses_location_id ON public.courses (location_id);
CREATE INDEX IF NOT EXISTS idx_courses_sport_id ON public.courses (sport_id);
CREATE INDEX IF NOT EXISTS idx_locations_club_id ON public.locations (club_id);
CREATE INDEX IF NOT EXISTS idx_locations_created_by_user_id ON public.locations (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_user_recent_locations_location_id ON public.user_recent_locations (location_id);

-- ------------------------------------------------------------
-- B. Column-level hardening for the anonymous (public) role.
--    RLS still allows row access; these GRANTs cap WHICH columns anon may read.
--    authenticated keeps full access (admin panel, club roster, owner edit forms).
-- ------------------------------------------------------------

-- profiles: anon may read only public display fields (no email/phone/oauth ids).
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, name, avatar_url, role) ON public.profiles TO anon;

-- coach_profiles: anon may read only public profile fields (no stripe/company/bank).
REVOKE SELECT ON public.coach_profiles FROM anon;
GRANT SELECT (id, user_id, bio, avatar_url, photo_storage_path) ON public.coach_profiles TO anon;

-- clubs: anon may read public directory fields (no stripe/company/bank).
REVOKE SELECT ON public.clubs FROM anon;
GRANT SELECT (
  id, owner_user_id, name, description, logo_storage_path, hero_photo_storage_path,
  website, phone, email, public_email_consent, address, city, created_at
) ON public.clubs TO anon;

-- ------------------------------------------------------------
-- C. Stop public buckets from being listable (keep URL access).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "course_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "coach_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "club_assets_public_read" ON storage.objects;
DROP POLICY IF EXISTS "activity_photos_public_read" ON storage.objects;
