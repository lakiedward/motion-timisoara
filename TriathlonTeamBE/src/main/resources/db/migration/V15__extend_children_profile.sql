-- Extend children table with additional profile fields
ALTER TABLE children
  ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS secondary_contact_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS secondary_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS tshirt_size VARCHAR(16),
  ADD COLUMN IF NOT EXISTS photo BYTEA,
  ADD COLUMN IF NOT EXISTS photo_content_type VARCHAR(64);
