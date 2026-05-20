-- Student freemium monetization: entitlement columns on profiles, usage-event
-- extensions on api_rate_limits, and a shared idempotency table for Stripe
-- webhook + post-checkout session-verify provisioning.

-- 1. Entitlement lives on profiles (every AI route already loads this row).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'plus', 'unlimited')),
  ADD COLUMN IF NOT EXISTS plan_expires_at        timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id     text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status    text,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end   boolean NOT NULL DEFAULT false;

-- 2. api_rate_limits doubles as the AI usage event log. `billable=true` rows
--    are the ones the monthly quota counts; `cost_cents` is for cost tuning.
ALTER TABLE api_rate_limits
  ADD COLUMN IF NOT EXISTS cost_cents int,
  ADD COLUMN IF NOT EXISTS billable   boolean NOT NULL DEFAULT false;

-- Partial index to keep monthly-quota counts cheap as the table grows.
CREATE INDEX IF NOT EXISTS api_rate_limits_user_billable_created
  ON api_rate_limits(user_id, created_at)
  WHERE billable = true;

-- 3. Shared idempotency gate for Stripe webhook + checkout session-verify
--    fallback. Service-role only; no anon/auth policies.
CREATE TABLE IF NOT EXISTS webhook_events (
  id           text PRIMARY KEY,         -- Stripe event id OR checkout session id
  source       text NOT NULL,            -- 'webhook' | 'session_verify'
  processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
