-- ─── Email Verification Tokens ──────────────────────────────────────────────
-- Custom token-based email verification system.
-- Allows professionals to verify their email via a unique 64-char token.

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evt_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_evt_professional ON email_verification_tokens(professional_id);
CREATE INDEX IF NOT EXISTS idx_evt_unused ON email_verification_tokens(used_at) WHERE used_at IS NULL;

ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Only service_role can access (tokens are sensitive)
CREATE POLICY "No direct access — service role only"
  ON email_verification_tokens
  USING (false);

COMMENT ON TABLE email_verification_tokens IS
  'Tokens for custom email verification. Generated at signup, consumed by GET /api/auth/verify-email?token=...';
