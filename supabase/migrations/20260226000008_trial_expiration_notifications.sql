-- ─── Trial Expiration Notifications Tracking ─────────────────────────────────
-- Tracks which trial expiration emails have been sent per professional,
-- preventing duplicate sends and enabling conversion metrics.

CREATE TABLE IF NOT EXISTS trial_expiration_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('day_7', 'day_3', 'day_1')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  clicked_upgrade_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (professional_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_ten_professional ON trial_expiration_notifications(professional_id);
CREATE INDEX IF NOT EXISTS idx_ten_type ON trial_expiration_notifications(notification_type);

ALTER TABLE trial_expiration_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON trial_expiration_notifications
  USING (false);

COMMENT ON TABLE trial_expiration_notifications IS
  'Tracks trial expiration notification emails (day_7, day_3, day_1). One row per professional per type.';
