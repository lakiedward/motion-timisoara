-- ============================================================
-- Motion Timisoara - Supabase Schema Migration
-- Replaces: TriathlonTeamBE Flyway migrations V1-V40
-- ============================================================

-- =====================
-- PROFILES (replaces users table)
-- Links to auth.users managed by Supabase Auth
-- =====================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'CLUB', 'COACH', 'PARENT')),
    avatar_url TEXT,
    oauth_provider TEXT,
    oauth_provider_id TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_email_idx ON profiles(email);

-- =====================
-- SPORTS
-- =====================
CREATE TABLE public.sports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
);

-- =====================
-- COACH_PROFILES
-- =====================
CREATE TABLE public.coach_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    bio TEXT,
    avatar_url TEXT,
    photo_storage_path TEXT,
    -- Stripe Connect
    stripe_account_id TEXT,
    stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
    stripe_charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    stripe_payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    -- Company info
    has_company BOOLEAN NOT NULL DEFAULT FALSE,
    company_name TEXT,
    company_cui TEXT,
    company_reg_number TEXT,
    company_address TEXT,
    bank_account TEXT,
    bank_name TEXT
);

-- =====================
-- COACH_SPORTS (join table)
-- =====================
CREATE TABLE public.coach_sports (
    coach_profile_id UUID NOT NULL REFERENCES coach_profiles(id) ON DELETE CASCADE,
    sport_id UUID NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
    PRIMARY KEY (coach_profile_id, sport_id)
);

-- =====================
-- CLUBS
-- =====================
CREATE TABLE public.clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    logo_storage_path TEXT,
    hero_photo_storage_path TEXT,
    website TEXT,
    phone TEXT,
    email TEXT,
    public_email_consent BOOLEAN NOT NULL DEFAULT FALSE,
    address TEXT,
    city TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Stripe Connect
    stripe_account_id TEXT,
    stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
    stripe_charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    stripe_payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    -- Company info
    company_name TEXT,
    company_cui TEXT,
    company_reg_number TEXT,
    company_address TEXT,
    bank_account TEXT,
    bank_name TEXT
);

-- =====================
-- CLUB_SPORTS, CLUB_COACHES (join tables)
-- =====================
CREATE TABLE public.club_sports (
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    sport_id UUID NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
    PRIMARY KEY (club_id, sport_id)
);

CREATE TABLE public.club_coaches (
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    coach_profile_id UUID NOT NULL REFERENCES coach_profiles(id) ON DELETE CASCADE,
    PRIMARY KEY (club_id, coach_profile_id)
);

-- =====================
-- LOCATIONS
-- =====================
CREATE TABLE public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('POOL', 'TRACK', 'GYM', 'OTHER')),
    address TEXT,
    city TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    capacity INTEGER,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
    created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Full-text search index
ALTER TABLE locations ADD COLUMN fts tsvector
    GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(address, '') || ' ' || coalesce(city, ''))
    ) STORED;
CREATE INDEX locations_fts_idx ON locations USING GIN(fts);

-- =====================
-- COURSES
-- =====================
CREATE TABLE public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sport_id UUID NOT NULL REFERENCES sports(id),
    level TEXT,
    age_from INTEGER,
    age_to INTEGER,
    coach_id UUID NOT NULL REFERENCES profiles(id),
    club_id UUID REFERENCES clubs(id),
    payment_recipient TEXT NOT NULL DEFAULT 'COACH' CHECK (payment_recipient IN ('COACH', 'CLUB')),
    location_id UUID NOT NULL REFERENCES locations(id),
    capacity INTEGER,
    price BIGINT NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'RON',
    price_per_session BIGINT NOT NULL DEFAULT 0,
    package_options TEXT,
    recurrence_rule TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    hero_photo_storage_path TEXT
);
CREATE INDEX courses_coach_idx ON courses(coach_id);
CREATE INDEX courses_club_idx ON courses(club_id);

-- =====================
-- COURSE_OCCURRENCES
-- =====================
CREATE TABLE public.course_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX course_occurrences_course_idx ON course_occurrences(course_id);

-- =====================
-- CAMPS
-- =====================
CREATE TABLE public.camps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    location_text TEXT,
    capacity INTEGER,
    price BIGINT NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'RON',
    gallery_json TEXT,
    allow_cash BOOLEAN NOT NULL DEFAULT FALSE
);

-- =====================
-- ACTIVITIES
-- =====================
CREATE TABLE public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    sport_id UUID NOT NULL REFERENCES sports(id),
    coach_id UUID NOT NULL REFERENCES profiles(id),
    club_id UUID REFERENCES clubs(id),
    payment_recipient TEXT NOT NULL DEFAULT 'COACH' CHECK (payment_recipient IN ('COACH', 'CLUB')),
    location_id UUID NOT NULL REFERENCES locations(id),
    activity_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    price BIGINT NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'RON',
    capacity INTEGER,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    hero_photo_storage_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ
);
CREATE INDEX activities_coach_idx ON activities(coach_id);
CREATE INDEX activities_club_idx ON activities(club_id);

-- =====================
-- CHILDREN
-- =====================
CREATE TABLE public.children (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    birth_date DATE NOT NULL,
    level TEXT,
    allergies TEXT,
    emergency_contact_name TEXT,
    emergency_phone TEXT,
    gdpr_consent_at TIMESTAMPTZ,
    secondary_contact_name TEXT,
    secondary_phone TEXT,
    tshirt_size TEXT,
    photo_storage_path TEXT
);
CREATE INDEX children_parent_idx ON children(parent_id);

-- =====================
-- ENROLLMENTS
-- =====================
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL CHECK (kind IN ('COURSE', 'CAMP', 'ACTIVITY')),
    entity_id UUID NOT NULL,
    child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PENDING', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    first_session_date DATE,
    purchased_sessions INTEGER NOT NULL DEFAULT 0,
    remaining_sessions INTEGER NOT NULL DEFAULT 0,
    sessions_used INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX enrollments_child_idx ON enrollments(child_id);
CREATE INDEX enrollments_entity_idx ON enrollments(entity_id);
CREATE INDEX enrollments_status_idx ON enrollments(status);

-- =====================
-- PAYMENTS
-- =====================
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    method TEXT NOT NULL CHECK (method IN ('CARD', 'CASH')),
    amount BIGINT NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'RON',
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIAL')),
    gateway_txn_id TEXT,
    client_secret TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ,
    billing_name TEXT,
    billing_email TEXT,
    billing_address_line1 TEXT,
    billing_city TEXT,
    billing_postal_code TEXT,
    billing_country TEXT,
    invoice_url TEXT,
    invoice_id TEXT,
    stripe_transfer_id TEXT,
    platform_fee_amount BIGINT,
    coach_payout_amount BIGINT
);
CREATE INDEX payments_enrollment_idx ON payments(enrollment_id);
CREATE INDEX payments_gateway_txn_idx ON payments(gateway_txn_id);

-- =====================
-- MONTHLY_PAYMENTS
-- =====================
CREATE TABLE public.monthly_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    month_year TEXT NOT NULL,
    amount BIGINT NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'RON',
    method TEXT NOT NULL CHECK (method IN ('CARD', 'CASH')),
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIAL')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX monthly_payments_enrollment_idx ON monthly_payments(enrollment_id);

-- =====================
-- ATTENDANCE
-- =====================
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id UUID NOT NULL REFERENCES course_occurrences(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT')),
    note TEXT
);
CREATE INDEX attendance_occ_child_idx ON attendance(occurrence_id, child_id);

-- =====================
-- COURSE_PHOTOS
-- =====================
CREATE TABLE public.course_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    content_type TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX course_photos_course_idx ON course_photos(course_id);

-- =====================
-- COURSE_ANNOUNCEMENTS
-- =====================
CREATE TABLE public.course_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES profiles(id),
    content TEXT NOT NULL,
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX course_announcements_course_idx ON course_announcements(course_id);

-- =====================
-- ANNOUNCEMENT_ATTACHMENTS
-- =====================
CREATE TABLE public.announcement_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES course_announcements(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('IMAGE', 'VIDEO', 'URL')),
    display_order INTEGER NOT NULL DEFAULT 0,
    storage_path TEXT,
    content_type TEXT,
    url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX announcement_attachments_ann_idx ON announcement_attachments(announcement_id);

-- =====================
-- CLUB_ANNOUNCEMENTS
-- =====================
CREATE TABLE public.club_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES profiles(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    publish_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX club_announcements_club_idx ON club_announcements(club_id);

-- =====================
-- COURSE_RATINGS
-- =====================
CREATE TABLE public.course_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES profiles(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(course_id, parent_id)
);

-- =====================
-- COACH_RATINGS
-- =====================
CREATE TABLE public.coach_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES profiles(id),
    parent_id UUID NOT NULL REFERENCES profiles(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(coach_id, parent_id)
);

-- =====================
-- INVOICES
-- =====================
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    smartbill_series TEXT,
    smartbill_number TEXT,
    smartbill_id TEXT,
    invoice_type TEXT NOT NULL CHECK (invoice_type IN ('COURSE', 'CAMP', 'ACTIVITY')),
    issuer_type TEXT NOT NULL CHECK (issuer_type IN ('PLATFORM', 'COACH')),
    subtotal BIGINT NOT NULL DEFAULT 0,
    vat_amount BIGINT NOT NULL DEFAULT 0,
    total_amount BIGINT NOT NULL DEFAULT 0,
    platform_fee BIGINT NOT NULL DEFAULT 0,
    platform_fee_vat BIGINT NOT NULL DEFAULT 0,
    coach_amount BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'COMPLETED', 'FAILED', 'ANAF_SUBMITTED')),
    anaf_index TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ,
    anaf_submitted_at TIMESTAMPTZ,
    error_message TEXT
);
CREATE INDEX invoices_payment_idx ON invoices(payment_id);

-- =====================
-- COACH_INVITATION_CODES
-- =====================
CREATE TABLE public.coach_invitation_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    created_by_admin_id UUID NOT NULL REFERENCES profiles(id),
    used_by_user_id UUID REFERENCES profiles(id),
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    max_uses INTEGER NOT NULL DEFAULT 1,
    current_uses INTEGER NOT NULL DEFAULT 0,
    notes TEXT
);

-- =====================
-- CLUB_INVITATION_CODES
-- =====================
CREATE TABLE public.club_invitation_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES profiles(id),
    max_uses INTEGER NOT NULL DEFAULT 1,
    current_uses INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT
);

-- =====================
-- USER_RECENT_LOCATIONS
-- =====================
CREATE TABLE public.user_recent_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    use_count INTEGER NOT NULL DEFAULT 1,
    UNIQUE(user_id, location_id)
);

-- =====================
-- AUDIT_LOGS
-- =====================
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID,
    target_entity_id UUID NOT NULL,
    target_entity_type TEXT NOT NULL,
    action TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address TEXT,
    metadata JSONB
);
CREATE INDEX audit_logs_actor_idx ON audit_logs(actor_user_id);
CREATE INDEX audit_logs_target_idx ON audit_logs(target_entity_id);
CREATE INDEX audit_logs_type_action_idx ON audit_logs(target_entity_type, action, timestamp);
CREATE INDEX audit_logs_metadata_idx ON audit_logs USING GIN(metadata);
