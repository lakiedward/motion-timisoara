-- Add club association and payment recipient to courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE SET NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS payment_recipient VARCHAR(20) NOT NULL DEFAULT 'COACH';

-- Add club association and payment recipient to activities
ALTER TABLE activities ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE SET NULL;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS payment_recipient VARCHAR(20) NOT NULL DEFAULT 'COACH';

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_courses_club_id ON courses(club_id);
CREATE INDEX IF NOT EXISTS idx_activities_club_id ON activities(club_id);
