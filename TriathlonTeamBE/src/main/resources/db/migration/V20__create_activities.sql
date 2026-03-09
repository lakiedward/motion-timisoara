-- Create activities table for one-time events
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sport VARCHAR(50) NOT NULL REFERENCES sports(code),
    coach_id UUID NOT NULL REFERENCES users(id),
    location_id UUID NOT NULL REFERENCES locations(id),
    activity_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    price BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'RON',
    capacity INT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for common queries
CREATE INDEX idx_activities_date ON activities(activity_date);
CREATE INDEX idx_activities_coach ON activities(coach_id);
CREATE INDEX idx_activities_sport ON activities(sport);
CREATE INDEX idx_activities_active ON activities(active);

-- Add ACTIVITY to enrollment_kind enum if using native enum
-- For string-based enums in JPA, no DB change needed

COMMENT ON TABLE activities IS 'One-time activities/events (Activități)';
