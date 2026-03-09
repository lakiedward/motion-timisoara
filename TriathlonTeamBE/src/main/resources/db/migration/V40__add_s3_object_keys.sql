-- Add S3 object key columns for migrating media from PostgreSQL BYTEA to Railway S3 buckets.
-- All columns are nullable: if set, media is served from S3; if null, fallback to BYTEA column.

ALTER TABLE courses ADD COLUMN hero_photo_s3_key VARCHAR(500);

ALTER TABLE course_photos ADD COLUMN photo_s3_key VARCHAR(500);

ALTER TABLE coach_profiles ADD COLUMN photo_s3_key VARCHAR(500);

ALTER TABLE clubs ADD COLUMN logo_s3_key VARCHAR(500);
ALTER TABLE clubs ADD COLUMN hero_photo_s3_key VARCHAR(500);

ALTER TABLE activities ADD COLUMN hero_photo_s3_key VARCHAR(500);

ALTER TABLE announcement_attachments ADD COLUMN image_s3_key VARCHAR(500);
ALTER TABLE announcement_attachments ADD COLUMN video_s3_key VARCHAR(500);
