-- Add marketing email opt-out columns to professionals
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS marketing_emails_opted_out BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS marketing_opted_out_at TIMESTAMPTZ;

-- Backfill tokens for existing professionals
UPDATE professionals
SET unsubscribe_token = encode(gen_random_bytes(32), 'hex')
WHERE unsubscribe_token IS NULL;

-- Set NOT NULL + DEFAULT after backfill
ALTER TABLE professionals
  ALTER COLUMN unsubscribe_token SET NOT NULL,
  ALTER COLUMN unsubscribe_token SET DEFAULT encode(gen_random_bytes(32), 'hex');

CREATE INDEX IF NOT EXISTS idx_professionals_unsubscribe_token
  ON professionals(unsubscribe_token);
