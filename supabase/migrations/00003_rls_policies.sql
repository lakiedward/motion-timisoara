-- ============================================================
-- Row Level Security Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_invitation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_invitation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_recent_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================
-- PROFILES
-- =====================
CREATE POLICY "profiles_select_public" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_admin_update" ON profiles
    FOR UPDATE USING (get_my_role() = 'ADMIN');

CREATE POLICY "profiles_admin_delete" ON profiles
    FOR DELETE USING (get_my_role() = 'ADMIN');

-- =====================
-- SPORTS
-- =====================
CREATE POLICY "sports_select_public" ON sports
    FOR SELECT USING (true);

CREATE POLICY "sports_admin_all" ON sports
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- COACH_PROFILES
-- =====================
CREATE POLICY "coach_profiles_select_public" ON coach_profiles
    FOR SELECT USING (true);

CREATE POLICY "coach_profiles_update_own" ON coach_profiles
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "coach_profiles_insert_own" ON coach_profiles
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "coach_profiles_admin_all" ON coach_profiles
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- COACH_SPORTS
-- =====================
CREATE POLICY "coach_sports_select_public" ON coach_sports
    FOR SELECT USING (true);

CREATE POLICY "coach_sports_manage_own" ON coach_sports
    FOR ALL USING (coach_profile_id = get_my_coach_profile_id());

CREATE POLICY "coach_sports_admin_all" ON coach_sports
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- CLUBS
-- =====================
CREATE POLICY "clubs_select_public" ON clubs
    FOR SELECT USING (true);

CREATE POLICY "clubs_update_owner" ON clubs
    FOR UPDATE USING (owner_user_id = auth.uid())
    WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "clubs_insert_owner" ON clubs
    FOR INSERT WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "clubs_admin_all" ON clubs
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- CLUB_SPORTS
-- =====================
CREATE POLICY "club_sports_select_public" ON club_sports
    FOR SELECT USING (true);

CREATE POLICY "club_sports_manage_owner" ON club_sports
    FOR ALL USING (club_id IN (SELECT id FROM clubs WHERE owner_user_id = auth.uid()));

CREATE POLICY "club_sports_admin_all" ON club_sports
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- CLUB_COACHES
-- =====================
CREATE POLICY "club_coaches_select_public" ON club_coaches
    FOR SELECT USING (true);

CREATE POLICY "club_coaches_manage_owner" ON club_coaches
    FOR ALL USING (club_id IN (SELECT id FROM clubs WHERE owner_user_id = auth.uid()));

CREATE POLICY "club_coaches_admin_all" ON club_coaches
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- LOCATIONS
-- =====================
CREATE POLICY "locations_select_public_active" ON locations
    FOR SELECT USING (is_active = true);

CREATE POLICY "locations_select_privileged" ON locations
    FOR SELECT USING (get_my_role() IN ('COACH', 'ADMIN', 'CLUB'));

CREATE POLICY "locations_manage_own" ON locations
    FOR ALL USING (created_by_user_id = auth.uid());

CREATE POLICY "locations_manage_club" ON locations
    FOR ALL USING (club_id IN (SELECT id FROM clubs WHERE owner_user_id = auth.uid()));

CREATE POLICY "locations_admin_all" ON locations
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- COURSES
-- =====================
CREATE POLICY "courses_select_public_active" ON courses
    FOR SELECT USING (active = true);

CREATE POLICY "courses_select_coach_own" ON courses
    FOR SELECT USING (coach_id = auth.uid());

CREATE POLICY "courses_select_club_own" ON courses
    FOR SELECT USING (club_id IN (SELECT id FROM clubs WHERE owner_user_id = auth.uid()));

CREATE POLICY "courses_insert_coach" ON courses
    FOR INSERT WITH CHECK (coach_id = auth.uid());

CREATE POLICY "courses_update_coach_own" ON courses
    FOR UPDATE USING (coach_id = auth.uid())
    WITH CHECK (coach_id = auth.uid());

CREATE POLICY "courses_admin_all" ON courses
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- COURSE_OCCURRENCES
-- =====================
CREATE POLICY "occurrences_select_public" ON course_occurrences
    FOR SELECT USING (true);

CREATE POLICY "occurrences_manage_coach" ON course_occurrences
    FOR ALL USING (course_id IN (SELECT id FROM courses WHERE coach_id = auth.uid()));

CREATE POLICY "occurrences_admin_all" ON course_occurrences
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- CAMPS
-- =====================
CREATE POLICY "camps_select_public" ON camps
    FOR SELECT USING (true);

CREATE POLICY "camps_admin_all" ON camps
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- ACTIVITIES
-- =====================
CREATE POLICY "activities_select_public_active" ON activities
    FOR SELECT USING (active = true);

CREATE POLICY "activities_select_coach_own" ON activities
    FOR SELECT USING (coach_id = auth.uid());

CREATE POLICY "activities_insert_coach" ON activities
    FOR INSERT WITH CHECK (coach_id = auth.uid());

CREATE POLICY "activities_update_coach_own" ON activities
    FOR UPDATE USING (coach_id = auth.uid())
    WITH CHECK (coach_id = auth.uid());

CREATE POLICY "activities_admin_all" ON activities
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- CHILDREN
-- =====================
CREATE POLICY "children_select_parent_own" ON children
    FOR SELECT USING (parent_id = auth.uid());

CREATE POLICY "children_insert_parent" ON children
    FOR INSERT WITH CHECK (parent_id = auth.uid());

CREATE POLICY "children_update_parent_own" ON children
    FOR UPDATE USING (parent_id = auth.uid())
    WITH CHECK (parent_id = auth.uid());

CREATE POLICY "children_delete_parent_own" ON children
    FOR DELETE USING (parent_id = auth.uid());

-- Coach reads children enrolled in their courses
CREATE POLICY "children_select_coach_enrolled" ON children
    FOR SELECT USING (
        id IN (
            SELECT e.child_id FROM enrollments e
            JOIN courses c ON e.entity_id = c.id AND e.kind = 'COURSE'
            WHERE c.coach_id = auth.uid() AND e.status = 'ACTIVE'
        )
        OR id IN (
            SELECT e.child_id FROM enrollments e
            JOIN activities a ON e.entity_id = a.id AND e.kind = 'ACTIVITY'
            WHERE a.coach_id = auth.uid() AND e.status = 'ACTIVE'
        )
    );

-- Club reads children enrolled in club courses
CREATE POLICY "children_select_club_enrolled" ON children
    FOR SELECT USING (
        id IN (
            SELECT e.child_id FROM enrollments e
            JOIN courses c ON e.entity_id = c.id AND e.kind = 'COURSE'
            JOIN clubs cl ON c.club_id = cl.id
            WHERE cl.owner_user_id = auth.uid() AND e.status = 'ACTIVE'
        )
    );

CREATE POLICY "children_admin_all" ON children
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- ENROLLMENTS
-- =====================
-- Parent reads own enrollments (through children)
CREATE POLICY "enrollments_select_parent" ON enrollments
    FOR SELECT USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

-- Coach reads enrollments for own courses/activities
CREATE POLICY "enrollments_select_coach" ON enrollments
    FOR SELECT USING (
        (kind = 'COURSE' AND entity_id IN (SELECT id FROM courses WHERE coach_id = auth.uid()))
        OR (kind = 'ACTIVITY' AND entity_id IN (SELECT id FROM activities WHERE coach_id = auth.uid()))
    );

-- Club reads enrollments for club courses
CREATE POLICY "enrollments_select_club" ON enrollments
    FOR SELECT USING (
        kind = 'COURSE' AND entity_id IN (
            SELECT c.id FROM courses c JOIN clubs cl ON c.club_id = cl.id
            WHERE cl.owner_user_id = auth.uid()
        )
    );

-- INSERT/UPDATE via Edge Functions only (service role)
CREATE POLICY "enrollments_admin_all" ON enrollments
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- PAYMENTS
-- =====================
-- Parent reads own payments
CREATE POLICY "payments_select_parent" ON payments
    FOR SELECT USING (enrollment_id IN (
        SELECT e.id FROM enrollments e
        JOIN children c ON e.child_id = c.id
        WHERE c.parent_id = auth.uid()
    ));

-- Coach reads payments for own courses
CREATE POLICY "payments_select_coach" ON payments
    FOR SELECT USING (enrollment_id IN (
        SELECT e.id FROM enrollments e
        WHERE (e.kind = 'COURSE' AND e.entity_id IN (SELECT id FROM courses WHERE coach_id = auth.uid()))
           OR (e.kind = 'ACTIVITY' AND e.entity_id IN (SELECT id FROM activities WHERE coach_id = auth.uid()))
    ));

-- Club reads payments for club courses
CREATE POLICY "payments_select_club" ON payments
    FOR SELECT USING (enrollment_id IN (
        SELECT e.id FROM enrollments e
        WHERE e.kind = 'COURSE' AND e.entity_id IN (
            SELECT c.id FROM courses c JOIN clubs cl ON c.club_id = cl.id
            WHERE cl.owner_user_id = auth.uid()
        )
    ));

-- All mutations via Edge Functions (service role)
CREATE POLICY "payments_admin_all" ON payments
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- MONTHLY_PAYMENTS (same pattern as payments)
-- =====================
CREATE POLICY "monthly_payments_select_parent" ON monthly_payments
    FOR SELECT USING (enrollment_id IN (
        SELECT e.id FROM enrollments e
        JOIN children c ON e.child_id = c.id
        WHERE c.parent_id = auth.uid()
    ));

CREATE POLICY "monthly_payments_select_coach" ON monthly_payments
    FOR SELECT USING (enrollment_id IN (
        SELECT e.id FROM enrollments e
        WHERE (e.kind = 'COURSE' AND e.entity_id IN (SELECT id FROM courses WHERE coach_id = auth.uid()))
           OR (e.kind = 'ACTIVITY' AND e.entity_id IN (SELECT id FROM activities WHERE coach_id = auth.uid()))
    ));

CREATE POLICY "monthly_payments_admin_all" ON monthly_payments
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- ATTENDANCE
-- =====================
-- Parent reads attendance for own children
CREATE POLICY "attendance_select_parent" ON attendance
    FOR SELECT USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

-- Coach reads/manages attendance for own course occurrences
CREATE POLICY "attendance_manage_coach" ON attendance
    FOR ALL USING (occurrence_id IN (
        SELECT co.id FROM course_occurrences co
        JOIN courses c ON co.course_id = c.id
        WHERE c.coach_id = auth.uid()
    ));

-- Club reads attendance for club courses
CREATE POLICY "attendance_select_club" ON attendance
    FOR SELECT USING (occurrence_id IN (
        SELECT co.id FROM course_occurrences co
        JOIN courses c ON co.course_id = c.id
        JOIN clubs cl ON c.club_id = cl.id
        WHERE cl.owner_user_id = auth.uid()
    ));

CREATE POLICY "attendance_admin_all" ON attendance
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- COURSE_PHOTOS
-- =====================
CREATE POLICY "course_photos_select_public" ON course_photos
    FOR SELECT USING (true);

CREATE POLICY "course_photos_manage_coach" ON course_photos
    FOR ALL USING (course_id IN (SELECT id FROM courses WHERE coach_id = auth.uid()));

CREATE POLICY "course_photos_manage_club" ON course_photos
    FOR ALL USING (course_id IN (
        SELECT c.id FROM courses c JOIN clubs cl ON c.club_id = cl.id
        WHERE cl.owner_user_id = auth.uid()
    ));

CREATE POLICY "course_photos_admin_all" ON course_photos
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- COURSE_ANNOUNCEMENTS
-- =====================
-- Parents read announcements for courses their children are enrolled in
CREATE POLICY "announcements_select_parent" ON course_announcements
    FOR SELECT USING (course_id IN (
        SELECT e.entity_id FROM enrollments e
        JOIN children c ON e.child_id = c.id
        WHERE c.parent_id = auth.uid() AND e.kind = 'COURSE' AND e.status = 'ACTIVE'
    ));

CREATE POLICY "announcements_manage_coach" ON course_announcements
    FOR ALL USING (course_id IN (SELECT id FROM courses WHERE coach_id = auth.uid()));

CREATE POLICY "announcements_admin_all" ON course_announcements
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- ANNOUNCEMENT_ATTACHMENTS
-- =====================
CREATE POLICY "attachments_select_via_announcement" ON announcement_attachments
    FOR SELECT USING (announcement_id IN (SELECT id FROM course_announcements));

CREATE POLICY "attachments_manage_coach" ON announcement_attachments
    FOR ALL USING (announcement_id IN (
        SELECT ca.id FROM course_announcements ca
        JOIN courses c ON ca.course_id = c.id
        WHERE c.coach_id = auth.uid()
    ));

CREATE POLICY "attachments_admin_all" ON announcement_attachments
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- CLUB_ANNOUNCEMENTS
-- =====================
CREATE POLICY "club_announcements_select_public" ON club_announcements
    FOR SELECT USING (
        is_active = true
        AND (publish_at IS NULL OR publish_at <= now())
        AND (expires_at IS NULL OR expires_at > now())
    );

CREATE POLICY "club_announcements_manage_owner" ON club_announcements
    FOR ALL USING (club_id IN (SELECT id FROM clubs WHERE owner_user_id = auth.uid()));

CREATE POLICY "club_announcements_admin_all" ON club_announcements
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- COURSE_RATINGS
-- =====================
CREATE POLICY "course_ratings_select_public" ON course_ratings
    FOR SELECT USING (true);

CREATE POLICY "course_ratings_manage_parent" ON course_ratings
    FOR ALL USING (parent_id = auth.uid())
    WITH CHECK (parent_id = auth.uid());

CREATE POLICY "course_ratings_admin_all" ON course_ratings
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- COACH_RATINGS
-- =====================
CREATE POLICY "coach_ratings_select_public" ON coach_ratings
    FOR SELECT USING (true);

CREATE POLICY "coach_ratings_manage_parent" ON coach_ratings
    FOR ALL USING (parent_id = auth.uid())
    WITH CHECK (parent_id = auth.uid());

CREATE POLICY "coach_ratings_admin_all" ON coach_ratings
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- INVOICES
-- =====================
CREATE POLICY "invoices_select_parent" ON invoices
    FOR SELECT USING (payment_id IN (
        SELECT p.id FROM payments p
        JOIN enrollments e ON p.enrollment_id = e.id
        JOIN children c ON e.child_id = c.id
        WHERE c.parent_id = auth.uid()
    ));

CREATE POLICY "invoices_select_coach" ON invoices
    FOR SELECT USING (payment_id IN (
        SELECT p.id FROM payments p
        JOIN enrollments e ON p.enrollment_id = e.id
        WHERE (e.kind = 'COURSE' AND e.entity_id IN (SELECT id FROM courses WHERE coach_id = auth.uid()))
           OR (e.kind = 'ACTIVITY' AND e.entity_id IN (SELECT id FROM activities WHERE coach_id = auth.uid()))
    ));

CREATE POLICY "invoices_admin_all" ON invoices
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- COACH_INVITATION_CODES
-- =====================
CREATE POLICY "coach_codes_admin_all" ON coach_invitation_codes
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- CLUB_INVITATION_CODES
-- =====================
CREATE POLICY "club_codes_manage_owner" ON club_invitation_codes
    FOR ALL USING (club_id IN (SELECT id FROM clubs WHERE owner_user_id = auth.uid()));

CREATE POLICY "club_codes_admin_all" ON club_invitation_codes
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- USER_RECENT_LOCATIONS
-- =====================
CREATE POLICY "recent_locations_manage_own" ON user_recent_locations
    FOR ALL USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "recent_locations_admin_all" ON user_recent_locations
    FOR ALL USING (get_my_role() = 'ADMIN');

-- =====================
-- AUDIT_LOGS
-- =====================
CREATE POLICY "audit_logs_admin_select" ON audit_logs
    FOR SELECT USING (get_my_role() = 'ADMIN');

CREATE POLICY "audit_logs_admin_all" ON audit_logs
    FOR ALL USING (get_my_role() = 'ADMIN');
