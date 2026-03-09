-- Create course_ratings table
CREATE TABLE course_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL,
    parent_id UUID NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_course_ratings_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_course_ratings_parent FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_course_parent_rating UNIQUE (course_id, parent_id)
);

-- Create coach_ratings table
CREATE TABLE coach_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL,
    parent_id UUID NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_coach_ratings_coach FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_coach_ratings_parent FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_coach_parent_rating UNIQUE (coach_id, parent_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_course_ratings_course_id ON course_ratings(course_id);
CREATE INDEX idx_course_ratings_parent_id ON course_ratings(parent_id);
CREATE INDEX idx_coach_ratings_coach_id ON coach_ratings(coach_id);
CREATE INDEX idx_coach_ratings_parent_id ON coach_ratings(parent_id);

