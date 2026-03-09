-- Add video storage columns for announcement attachments

ALTER TABLE announcement_attachments
    ADD COLUMN IF NOT EXISTS video BYTEA,
    ADD COLUMN IF NOT EXISTS video_content_type VARCHAR(100);
