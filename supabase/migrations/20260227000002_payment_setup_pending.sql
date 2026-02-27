-- Adicionar colunas de configuração de pagamento simplificada
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IN ('stripe_pending', 'stripe_active', 'manual'))
    DEFAULT 'stripe_pending',
  ADD COLUMN IF NOT EXISTS payment_full_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_dob DATE,
  ADD COLUMN IF NOT EXISTS payment_iban TEXT,
  ADD COLUMN IF NOT EXISTS payment_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS payment_address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS payment_city TEXT,
  ADD COLUMN IF NOT EXISTS payment_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS payment_country TEXT DEFAULT 'IE',
  ADD COLUMN IF NOT EXISTS stripe_onboarding_status TEXT
    CHECK (stripe_onboarding_status IN ('pending', 'completed', 'failed'))
    DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS manual_payment_key TEXT;
