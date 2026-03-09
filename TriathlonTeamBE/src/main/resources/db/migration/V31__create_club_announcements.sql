-- Create club announcements table
CREATE TABLE IF NOT EXISTS club_announcements (
    id UUID PRIMARY KEY,
    club_id UUID NOT NULL,
    author_user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(32) NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    publish_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_club_announcements_club FOREIGN KEY (club_id) REFERENCES clubs (id) ON DELETE CASCADE,
    CONSTRAINT fk_club_announcements_author FOREIGN KEY (author_user_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_club_announcements_club_created ON club_announcements (club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_announcements_active ON club_announcements (club_id, is_active);
CREATE INDEX IF NOT EXISTS idx_club_announcements_priority ON club_announcements (club_id, priority);
