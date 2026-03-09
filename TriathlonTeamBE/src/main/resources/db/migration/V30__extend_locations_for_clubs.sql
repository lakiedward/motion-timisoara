-- Extend locations table for club ownership
ALTER TABLE locations ADD COLUMN IF NOT EXISTS city VARCHAR(255);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS capacity INTEGER;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE SET NULL;

-- Index for faster club location queries
CREATE INDEX IF NOT EXISTS idx_locations_club_id ON locations(club_id);
