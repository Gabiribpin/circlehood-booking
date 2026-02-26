-- ─── Retention Emails Tracking ───────────────────────────────────────────────
-- Tracks which retention emails have been sent to professionals marked for deletion.

CREATE TABLE IF NOT EXISTS retention_emails_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL CHECK (email_type IN ('day_7', 'day_14', 'day_28')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_deletion BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (professional_id, email_type)
);

CREATE INDEX IF NOT EXISTS idx_retention_emails_professional
  ON retention_emails_sent(professional_id);
CREATE INDEX IF NOT EXISTS idx_retention_emails_type
  ON retention_emails_sent(email_type);

ALTER TABLE retention_emails_sent ENABLE ROW LEVEL SECURITY;

-- Only service-role (cron) can read/write; no professional-level access needed.
-- (No RLS policy added for user-level — service role bypasses RLS)
