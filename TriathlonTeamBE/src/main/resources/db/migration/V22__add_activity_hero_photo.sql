-- Add hero_photo column to activities table
ALTER TABLE activities ADD COLUMN IF NOT EXISTS hero_photo TEXT;

COMMENT ON COLUMN activities.hero_photo IS 'Base64 encoded hero image for the activity';
