-- Tracking table for onboarding reminder emails
CREATE TABLE IF NOT EXISTS onboarding_reminders_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('day_3', 'day_7')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (professional_id, reminder_type)
);

CREATE INDEX idx_onboarding_reminders_prof ON onboarding_reminders_sent(professional_id);
ALTER TABLE onboarding_reminders_sent ENABLE ROW LEVEL SECURITY;

-- Service role only (cron context)
CREATE POLICY "Service role only" ON onboarding_reminders_sent USING (false);
