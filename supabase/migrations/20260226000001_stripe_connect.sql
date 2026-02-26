-- Stripe Connect accounts table
CREATE TABLE IF NOT EXISTS stripe_connect_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL,
  charges_enabled BOOLEAN DEFAULT FALSE,
  payouts_enabled BOOLEAN DEFAULT FALSE,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  country TEXT DEFAULT 'IE',
  currency TEXT DEFAULT 'eur',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(professional_id),
  UNIQUE(stripe_account_id)
);

CREATE INDEX IF NOT EXISTS idx_stripe_connect_professional ON stripe_connect_accounts(professional_id);

ALTER TABLE stripe_connect_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional vê sua conta Connect"
  ON stripe_connect_accounts FOR SELECT
  USING (professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()));

-- Checkout Session tracking em payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_checkout_session ON payments(stripe_checkout_session_id);
