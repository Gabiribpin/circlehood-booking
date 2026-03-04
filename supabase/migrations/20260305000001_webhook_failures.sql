-- Webhook retry queue: persistent storage for failed webhook events.
-- Max 5 attempts with exponential backoff (1min, 5min, 30min, 2h, 12h).
-- After 5 failed attempts, status becomes 'dead_letter'.

CREATE TABLE IF NOT EXISTS webhook_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_type TEXT NOT NULL,        -- 'stripe', 'evolution_api', 'resend', 'revolut', 'stripe_connect', 'stripe_deposit'
  event_type TEXT,                   -- e.g. 'payment_intent.succeeded', 'messages.upsert'
  payload JSONB NOT NULL DEFAULT '{}',
  error TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'retrying', 'resolved', 'dead_letter'
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  last_attempted_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cron: find retryable failures efficiently
CREATE INDEX IF NOT EXISTS idx_webhook_failures_retry
  ON webhook_failures (status, next_retry_at)
  WHERE status IN ('pending', 'retrying');

-- Index for admin dashboard: filter by type
CREATE INDEX IF NOT EXISTS idx_webhook_failures_type
  ON webhook_failures (webhook_type, created_at DESC);

-- RLS: only service_role can access (admin/cron use service role client)
ALTER TABLE webhook_failures ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE webhook_failures IS
  'Webhook retry queue. RLS enabled, no user policies — only service_role can access.';
