-- Vida útil do serviço
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS lifetime_days INTEGER;

COMMENT ON COLUMN services.lifetime_days IS
  'Dias até o serviço precisar ser refeito. NULL = sem lembrete automático.';

-- Timestamp de conclusão do agendamento
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Controle de envio do lembrete de manutenção
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS maintenance_reminder_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_reminder_sent_at TIMESTAMPTZ;

-- Índice para o cron: buscar candidatos rapidamente
CREATE INDEX IF NOT EXISTS idx_bookings_maintenance_cron
  ON bookings (status, maintenance_reminder_sent, completed_at)
  WHERE status = 'completed'
    AND maintenance_reminder_sent = false
    AND completed_at IS NOT NULL;
