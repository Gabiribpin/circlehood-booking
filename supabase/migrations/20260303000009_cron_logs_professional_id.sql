-- Issue #21: Add professional_id to cron_logs for per-tenant filtering
-- Nullable because some crons are global (cleanup-tokens, refresh-analytics, etc.)

ALTER TABLE cron_logs
  ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cron_logs_professional_id
  ON cron_logs(professional_id)
  WHERE professional_id IS NOT NULL;
