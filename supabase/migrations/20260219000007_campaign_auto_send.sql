-- Adicionar colunas de rastreamento a campaigns
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS total_count   INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sent_count    INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_count  INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheduled_at  TIMESTAMPTZ;

-- Adicionar colunas para envio automático em campaign_sends
ALTER TABLE campaign_sends
  ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS phone          TEXT,
  ADD COLUMN IF NOT EXISTS name           TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_for  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error          TEXT;

-- Índice para o cron (busca pendentes com scheduled_for expirado)
CREATE INDEX IF NOT EXISTS idx_campaign_sends_cron
  ON campaign_sends(status, scheduled_for)
  WHERE status = 'pending';
