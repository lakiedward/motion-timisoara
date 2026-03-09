DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_type') THEN
        CREATE DOMAIN role_type AS VARCHAR(32) CHECK (VALUE IN ('ADMIN', 'COACH', 'PARENT'));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'location_type') THEN
        CREATE DOMAIN location_type AS VARCHAR(32) CHECK (VALUE IN ('POOL', 'TRACK', 'GYM', 'OTHER'));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_kind') THEN
        CREATE DOMAIN enrollment_kind AS VARCHAR(32) CHECK (VALUE IN ('COURSE', 'CAMP'));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_status') THEN
        CREATE DOMAIN enrollment_status AS VARCHAR(32) CHECK (VALUE IN ('ACTIVE', 'PENDING', 'CANCELLED'));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE DOMAIN payment_method AS VARCHAR(32) CHECK (VALUE IN ('CARD', 'CASH'));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE DOMAIN payment_status AS VARCHAR(32) CHECK (VALUE IN ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIAL'));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
        CREATE DOMAIN attendance_status AS VARCHAR(32) CHECK (VALUE IN ('PRESENT', 'ABSENT'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role role_type NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_uindex ON users (email);

CREATE TABLE IF NOT EXISTS coach_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    bio TEXT,
    sports TEXT,
    avatar_url VARCHAR(512),
    CONSTRAINT fk_coach_profiles_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS children (
    id UUID PRIMARY KEY,
    parent_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    birth_date DATE NOT NULL,
    level VARCHAR(255),
    allergies TEXT,
    emergency_phone VARCHAR(50),
    gdpr_consent_at TIMESTAMPTZ,
    CONSTRAINT fk_children_parent FOREIGN KEY (parent_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type location_type NOT NULL,
    address TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sport VARCHAR(255) NOT NULL,
    level VARCHAR(255),
    age_from INTEGER,
    age_to INTEGER,
    coach_id UUID NOT NULL,
    location_id UUID NOT NULL,
    capacity INTEGER,
    price BIGINT NOT NULL,
    recurrence_rule TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_courses_coach FOREIGN KEY (coach_id) REFERENCES users (id),
    CONSTRAINT fk_courses_location FOREIGN KEY (location_id) REFERENCES locations (id)
);

CREATE TABLE IF NOT EXISTS course_occurrences (
    id UUID PRIMARY KEY,
    course_id UUID NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_course_occurrences_course FOREIGN KEY (course_id) REFERENCES courses (id)
);

CREATE TABLE IF NOT EXISTS camps (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    location_text TEXT,
    capacity INTEGER,
    price BIGINT NOT NULL,
    gallery_json TEXT,
    allow_cash BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS camps_slug_uindex ON camps (slug);

CREATE TABLE IF NOT EXISTS enrollments (
    id UUID PRIMARY KEY,
    kind enrollment_kind NOT NULL,
    entity_id UUID NOT NULL,
    child_id UUID NOT NULL,
    status enrollment_status NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_enrollments_child FOREIGN KEY (child_id) REFERENCES children (id)
);

CREATE INDEX IF NOT EXISTS enrollments_entity_idx ON enrollments (entity_id);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY,
    enrollment_id UUID NOT NULL,
    method payment_method NOT NULL,
    amount BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'RON',
    status payment_status NOT NULL,
    gateway_txn_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_payments_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments (id)
);

CREATE INDEX IF NOT EXISTS payments_enrollment_idx ON payments (enrollment_id);
CREATE INDEX IF NOT EXISTS payments_gateway_txn_id_idx ON payments (gateway_txn_id);

CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY,
    occurrence_id UUID NOT NULL,
    child_id UUID NOT NULL,
    status attendance_status NOT NULL,
    note TEXT,
    CONSTRAINT fk_attendance_occurrence FOREIGN KEY (occurrence_id) REFERENCES course_occurrences (id),
    CONSTRAINT fk_attendance_child FOREIGN KEY (child_id) REFERENCES children (id)
);

CREATE INDEX IF NOT EXISTS attendance_occurrence_child_idx ON attendance (occurrence_id, child_id);
