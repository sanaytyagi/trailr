-- Extend api_rate_limits to support pre-auth (IP-keyed) entries used by
-- the /api/auth/* wrapper routes, and add the missing INSERT policy that the
-- existing AI routes rely on.

-- 1. Allow user_id to be NULL for pre-auth entries (e.g. signin attempts by IP+email).
ALTER TABLE api_rate_limits
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add a free-form key column. Used when user_id is NULL (e.g. "ip:1.2.3.4|email:foo@bar").
ALTER TABLE api_rate_limits
  ADD COLUMN IF NOT EXISTS key text;

-- 3. Require at least one identity dimension.
ALTER TABLE api_rate_limits
  ADD CONSTRAINT api_rate_limits_identity_chk
  CHECK (user_id IS NOT NULL OR key IS NOT NULL);

-- 4. Index the new lookup pattern (endpoint, key, created_at).
CREATE INDEX IF NOT EXISTS api_rate_limits_endpoint_key_created
  ON api_rate_limits(endpoint, key, created_at)
  WHERE key IS NOT NULL;

-- 5. INSERT policy for authenticated users (own rows only). Without this, the
--    existing AI route inserts have been silently failing under RLS.
DROP POLICY IF EXISTS "Users can insert own limits" ON api_rate_limits;
CREATE POLICY "Users can insert own limits" ON api_rate_limits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Note: pre-auth (key-only) inserts/reads are performed via the service-role
-- admin client in the auth wrapper routes, which bypasses RLS by design.
-- We deliberately do NOT add an anon-role policy for key-based rows to avoid
-- enumeration.
