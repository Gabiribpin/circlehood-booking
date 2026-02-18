-- Tipos de notificação
CREATE TYPE notification_type AS ENUM (
  'birthday',           -- Aniversário
  'reminder',          -- Lembrete de agendamento
  'waitlist',          -- Vaga na lista de espera
  'inactive_client',   -- Cliente inativo
  'follow_up',         -- Follow-up pós-atendimento
  'review_request'     -- Pedido de avaliação
);

-- Tabela de notificações
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed
  channel VARCHAR(20) DEFAULT 'whatsapp', -- whatsapp, email, sms
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_for, status);
CREATE INDEX idx_notifications_user ON notifications(user_id, status);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notifications"
  ON notifications FOR ALL
  USING (auth.uid() = user_id);
