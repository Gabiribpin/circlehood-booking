-- Configuração de pagamento de sinal nos profissionais
-- Permite que o profissional exija um depósito ao agendar

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS require_deposit        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_type           TEXT CHECK (deposit_type IN ('percentage', 'fixed')),
  ADD COLUMN IF NOT EXISTS deposit_value          DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS stripe_account_id      TEXT,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_completed BOOLEAN DEFAULT false;

COMMENT ON COLUMN professionals.require_deposit              IS 'Se true, exige sinal (depósito) ao agendar';
COMMENT ON COLUMN professionals.deposit_type                 IS 'percentage = % do serviço, fixed = valor fixo';
COMMENT ON COLUMN professionals.deposit_value                IS 'Se percentage: 0-100. Se fixed: valor na moeda do profissional';
COMMENT ON COLUMN professionals.stripe_account_id            IS 'Stripe Connect Account ID (opcional — para repasse direto)';
COMMENT ON COLUMN professionals.stripe_onboarding_completed  IS 'Onboarding Stripe Connect concluído';
