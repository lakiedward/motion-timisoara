-- Create course announcements tables

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_attachment_type') THEN
        CREATE DOMAIN announcement_attachment_type AS VARCHAR(32) CHECK (VALUE IN ('IMAGE', 'VIDEO_LINK'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS course_announcements (
    id UUID PRIMARY KEY,
    course_id UUID NOT NULL,
    author_user_id UUID NOT NULL,
    content TEXT NOT NULL,
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_course_announcements_course FOREIGN KEY (course_id) REFERENCES courses (id),
    CONSTRAINT fk_course_announcements_author FOREIGN KEY (author_user_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_course_announcements_course_created ON course_announcements (course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_announcements_pinned ON course_announcements (course_id, pinned);

CREATE TABLE IF NOT EXISTS announcement_attachments (
    id UUID PRIMARY KEY,
    announcement_id UUID NOT NULL,
    type announcement_attachment_type NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    image BYTEA,
    image_content_type VARCHAR(100),
    url VARCHAR(1024),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_announcement_attachments_announcement FOREIGN KEY (announcement_id) REFERENCES course_announcements (id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_attachments_announcement ON announcement_attachments (announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_attachments_type ON announcement_attachments (type);

-- Optional safety checks: ensure only IMAGE has image bytes and only VIDEO_LINK has url
-- These can be enforced via application logic; DB CHECK can be added later if needed.
