alter table colleges
  add column if not exists sat_25 integer,
  add column if not exists sat_75 integer,
  add column if not exists act_25 integer,
  add column if not exists act_75 integer,
  add column if not exists test_requirements integer;

-- test_requirements values from College Scorecard:
-- 1 = Required
-- 2 = Recommended
-- 3 = Neither required nor recommended (test-optional)
-- null = not reported
