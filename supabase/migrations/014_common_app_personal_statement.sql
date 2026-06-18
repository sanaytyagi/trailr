-- Allow essays to exist without a college (Common App personal statement).
-- Add essay_type column to distinguish supplemental vs personal statement essays.

ALTER TABLE essays
  ALTER COLUMN college_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'essays' AND column_name = 'essay_type'
  ) THEN
    ALTER TABLE essays
      ADD COLUMN essay_type text NOT NULL DEFAULT 'supplemental'
        CHECK (essay_type IN ('supplemental', 'personal_statement'));
  END IF;
END $$;
