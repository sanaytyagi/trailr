-- Core student profile captured at registration.
--
-- The AI surfaces (assistant, opening message, research brief + followup) all
-- personalize off the student's quiz answers. Before this, those answers only
-- existed as a side effect of generating a List Builder list
-- (user_colleges.colleges.quiz_answers), so a brand-new user who opened the
-- assistant or a brief before building a list got generic output.
--
-- core_profile holds a tiny required core (state, gpa, major) captured at
-- onboarding with a non-billable client-side write. Every AI route already
-- loads the profiles row, so reading it costs no extra query. The resolver
-- merges it with the full quiz_answers as { ...core_profile, ...quiz_answers }
-- (the full quiz wins on the 3 overlapping fields). Keys MUST match
-- quizAnswersSchema field names so that spread merge is key-aligned.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS core_profile jsonb;

-- Backfill existing students who already completed the full List Builder quiz
-- (quiz_answers present) but predate this column. Without this they would be
-- wrongly redirected to the onboarding core step even though we already have
-- their state/gpa/major. The proxy gate and onboarding have a runtime fallback
-- too, but populating core_profile here keeps the gate single-query and makes
-- the completion nudge behave correctly for these accounts.
UPDATE profiles p
SET core_profile = jsonb_build_object(
  'state', ul.colleges -> 'quiz_answers' ->> 'state',
  'gpa',   (ul.colleges -> 'quiz_answers' ->> 'gpa')::numeric,
  'major', ul.colleges -> 'quiz_answers' ->> 'major'
)
FROM user_lists ul
WHERE ul.user_id = p.id
  AND p.role = 'student'
  AND p.core_profile IS NULL
  AND ul.colleges -> 'quiz_answers' ->> 'state' IS NOT NULL
  AND ul.colleges -> 'quiz_answers' ->> 'gpa'   IS NOT NULL
  AND ul.colleges -> 'quiz_answers' ->> 'major' IS NOT NULL;
