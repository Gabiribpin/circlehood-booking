-- Tabela de pagamentos (sinais/depósitos via Stripe)

CREATE TABLE IF NOT EXISTS payments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id                UUID REFERENCES bookings(id) ON DELETE CASCADE,
  professional_id           UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  stripe_payment_intent_id  TEXT UNIQUE,
  stripe_charge_id          TEXT,
  amount                    DECIMAL(10,2) NOT NULL,
  currency                  TEXT NOT NULL DEFAULT 'EUR',
  status                    TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')),
  payment_method            TEXT,
  metadata                  JSONB,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para queries frequentes
CREATE INDEX IF NOT EXISTS idx_payments_booking_id   ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_professional  ON payments(professional_id);
CREATE INDEX IF NOT EXISTS idx_payments_status        ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_pi     ON payments(stripe_payment_intent_id);

COMMENT ON TABLE payments IS 'Histórico de pagamentos de sinais/depósitos via Stripe';

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_payments_updated_at();

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional vê seus próprios pagamentos"
  ON payments FOR SELECT
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

CREATE POLICY "Profissional gerencia seus próprios pagamentos"
  ON payments FOR ALL
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));
