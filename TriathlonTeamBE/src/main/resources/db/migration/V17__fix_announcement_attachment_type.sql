-- Fix announcement_attachment_type column to use VARCHAR instead of custom DOMAIN
-- This ensures compatibility with Hibernate's @Enumerated(EnumType.STRING)

ALTER TABLE announcement_attachments
    ALTER COLUMN type TYPE VARCHAR(32);

-- Drop the custom domain as it's no longer needed
DROP DOMAIN IF EXISTS announcement_attachment_type;
