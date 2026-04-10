ALTER TABLE essay_comments
  ADD COLUMN IF NOT EXISTS read_by_student boolean NOT NULL DEFAULT false;
