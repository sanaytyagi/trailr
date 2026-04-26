CREATE TABLE IF NOT EXISTS api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own limits" ON api_rate_limits
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS api_rate_limits_user_endpoint_created
  ON api_rate_limits(user_id, endpoint, created_at);
