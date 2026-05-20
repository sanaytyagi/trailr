-- Migrate essay_notes to student self-annotation schema.
-- The old table used counselor_id + note (text); replace with user_id + text + offsets.

DO $$
BEGIN
  -- Add new columns if they don't exist yet
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'essay_notes' AND column_name = 'user_id') THEN
    ALTER TABLE essay_notes ADD COLUMN user_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'essay_notes' AND column_name = 'start_offset') THEN
    ALTER TABLE essay_notes ADD COLUMN start_offset integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'essay_notes' AND column_name = 'end_offset') THEN
    ALTER TABLE essay_notes ADD COLUMN end_offset integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'essay_notes' AND column_name = 'color_index') THEN
    ALTER TABLE essay_notes ADD COLUMN color_index integer NOT NULL DEFAULT 0;
  END IF;

  -- Rename old 'note' column to 'text' if needed
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'essay_notes' AND column_name = 'note')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'essay_notes' AND column_name = 'text') THEN
    ALTER TABLE essay_notes RENAME COLUMN note TO text;
  END IF;

  -- Drop old counselor_id column if it exists (old schema artifact).
  -- Must drop dependent policies first.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'essay_notes' AND column_name = 'counselor_id') THEN
    DROP POLICY IF EXISTS "Counselors manage their own essay notes" ON essay_notes;
    DROP POLICY IF EXISTS "Counselors can view student essay notes" ON essay_notes;
    DROP POLICY IF EXISTS "Users can manage own essay notes" ON essay_notes;
    DELETE FROM essay_notes WHERE user_id IS NULL;
    ALTER TABLE essay_notes DROP COLUMN counselor_id;
  END IF;
END $$;

-- Ensure RLS is on
ALTER TABLE essay_notes ENABLE ROW LEVEL SECURITY;

-- Drop any remaining old policies then recreate
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage own essay notes" ON essay_notes;
  DROP POLICY IF EXISTS "Counselors can view student essay notes" ON essay_notes;
  DROP POLICY IF EXISTS "Counselors manage their own essay notes" ON essay_notes;
END $$;

CREATE POLICY "Users can manage own essay notes"
  ON essay_notes
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS essay_notes_essay_id_idx ON essay_notes(essay_id);
