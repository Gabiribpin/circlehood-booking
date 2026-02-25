-- Migration: account deletion fields for GDPR Art. 17 compliance
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS deletion_scheduled_for TIMESTAMPTZ DEFAULT NULL;

-- Index to speed up the cron job that processes deletions
CREATE INDEX IF NOT EXISTS idx_professionals_deletion_scheduled
  ON professionals (deletion_scheduled_for)
  WHERE deleted_at IS NOT NULL AND deletion_scheduled_for IS NOT NULL;

COMMENT ON COLUMN professionals.deleted_at IS 'Timestamp when user requested account deletion (Art. 17 GDPR)';
COMMENT ON COLUMN professionals.deletion_scheduled_for IS 'Account will be permanently deleted at this timestamp (deleted_at + 30 days)';
