-- Add currency columns required by entities Course and Camp
-- Safe for repeated runs using IF NOT EXISTS and two-step NOT NULL application

-- Courses.currency
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'currency'
  ) THEN
    ALTER TABLE courses ADD COLUMN currency VARCHAR(10);
    UPDATE courses SET currency = 'RON' WHERE currency IS NULL;
    ALTER TABLE courses ALTER COLUMN currency SET NOT NULL;
    ALTER TABLE courses ALTER COLUMN currency SET DEFAULT 'RON';
  END IF;
END $$;

-- Camps.currency
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'camps' AND column_name = 'currency'
  ) THEN
    ALTER TABLE camps ADD COLUMN currency VARCHAR(10);
    UPDATE camps SET currency = 'RON' WHERE currency IS NULL;
    ALTER TABLE camps ALTER COLUMN currency SET NOT NULL;
    ALTER TABLE camps ALTER COLUMN currency SET DEFAULT 'RON';
  END IF;
END $$;


