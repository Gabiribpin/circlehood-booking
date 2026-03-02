-- Add webhook_secret column to whatsapp_config
-- Per-instance secret for validating incoming Evolution API webhook requests.
-- Each instance gets its own UUID — if one leaks, only that instance is affected.
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- Populate existing rows with a random secret
UPDATE whatsapp_config
SET webhook_secret = gen_random_uuid()::text
WHERE webhook_secret IS NULL;

-- Set default for new rows
ALTER TABLE whatsapp_config
  ALTER COLUMN webhook_secret SET DEFAULT gen_random_uuid()::text;

-- Index for webhook validation lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_webhook_secret
  ON whatsapp_config(webhook_secret)
  WHERE webhook_secret IS NOT NULL;

COMMENT ON COLUMN whatsapp_config.webhook_secret IS 'Per-instance secret for webhook authentication. Generated on instance creation, validated on incoming webhooks.';
