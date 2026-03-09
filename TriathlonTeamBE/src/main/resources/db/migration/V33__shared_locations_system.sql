-- ============================================
-- V33: Shared Locations System
-- All locations become global/shared
-- Add tracking for user's recent locations
-- ============================================

-- Add created_by_user_id to track who created the location
ALTER TABLE locations ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create user_recent_locations table for tracking recently used locations
CREATE TABLE IF NOT EXISTS user_recent_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    use_count INTEGER NOT NULL DEFAULT 1,
    UNIQUE(user_id, location_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_recent_locations_user_id ON user_recent_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_recent_locations_last_used ON user_recent_locations(user_id, last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);
CREATE INDEX IF NOT EXISTS idx_locations_city_lower ON locations(LOWER(city));
CREATE INDEX IF NOT EXISTS idx_locations_name_search ON locations USING gin(to_tsvector('simple', name));

-- Note: club_id remains on locations table but will be ignored for visibility
-- All locations are now visible to everyone
