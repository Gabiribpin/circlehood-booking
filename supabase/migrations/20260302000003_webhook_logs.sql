-- Webhook logs for observability and debugging.
-- Retention: auto-delete entries older than 7 days via function.

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  instance_name TEXT NOT NULL,
  status INT NOT NULL,
  error TEXT,
  processing_time_ms INT,
  rate_limited BOOLEAN DEFAULT false,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_instance ON webhook_logs(instance_name);

-- Retention function: delete logs older than 7 days
CREATE OR REPLACE FUNCTION delete_old_webhook_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM webhook_logs
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE webhook_logs IS 'Webhook request logs for admin health monitoring. Auto-cleaned after 7 days.';
