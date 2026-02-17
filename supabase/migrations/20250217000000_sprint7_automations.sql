-- ========================================
-- SPRINT 7: AUTOMAÇÕES - DATABASE MIGRATION
-- Data: 17/02/2026
-- Descrição: Cria tabelas para automações, notificações,
--            reagendamento, waitlist, pacotes e fidelidade
-- ========================================

-- ========================================
-- 1. NOTIFICATION QUEUE
-- ========================================
CREATE TABLE notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('booking_confirmation', 'reminder', 'waitlist_available', 'loyalty_reward')),
  recipient_name text NOT NULL,
  recipient_phone text NOT NULL,
  recipient_email text,
  message_template text NOT NULL,
  message_data jsonb NOT NULL DEFAULT '{}',
  language text DEFAULT 'pt' CHECK (language IN ('pt', 'en', 'es')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at timestamp,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamp DEFAULT now()
);

CREATE INDEX idx_notification_queue_status ON notification_queue(status) WHERE status = 'pending';
CREATE INDEX idx_notification_queue_created ON notification_queue(created_at);
CREATE INDEX idx_notification_queue_professional ON notification_queue(professional_id);

COMMENT ON TABLE notification_queue IS 'Fila de notificações para processamento assíncrono';

-- ========================================
-- 2. NOTIFICATION LOGS
-- ========================================
CREATE TABLE notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  type text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email', 'sms')),
  recipient text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'delivered', 'read')),
  error_message text,
  created_at timestamp DEFAULT now()
);

CREATE INDEX idx_notification_logs_booking ON notification_logs(booking_id);
CREATE INDEX idx_notification_logs_professional ON notification_logs(professional_id);
CREATE INDEX idx_notification_logs_created ON notification_logs(created_at DESC);

COMMENT ON TABLE notification_logs IS 'Histórico completo de notificações enviadas';

-- ========================================
-- 3. RESCHEDULE TOKENS
-- ========================================
CREATE TABLE reschedule_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE UNIQUE,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamp NOT NULL DEFAULT (now() + interval '30 days'),
  used boolean DEFAULT false,
  used_at timestamp,
  ip_address inet,
  user_agent text,
  created_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX idx_reschedule_tokens_token ON reschedule_tokens(token);
CREATE INDEX idx_reschedule_tokens_booking ON reschedule_tokens(booking_id);
CREATE INDEX idx_reschedule_tokens_expires ON reschedule_tokens(expires_at) WHERE used = false;

COMMENT ON TABLE reschedule_tokens IS 'Tokens seguros para reagendamento pelo cliente';

-- ========================================
-- 4. WAITLIST
-- ========================================
CREATE TABLE waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  contact_email text,
  preferred_dates date[] NOT NULL,
  preferred_time_slots text[] CHECK (
    preferred_time_slots <@ ARRAY['morning', 'afternoon', 'evening']::text[]
  ),
  notes text,
  notified boolean DEFAULT false,
  notified_at timestamp,
  notification_expires_at timestamp,
  status text DEFAULT 'active' CHECK (status IN ('active', 'notified', 'expired', 'converted', 'cancelled')),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX idx_waitlist_professional ON waitlist(professional_id);
CREATE INDEX idx_waitlist_service ON waitlist(service_id);
CREATE INDEX idx_waitlist_status ON waitlist(status) WHERE status = 'active';
CREATE INDEX idx_waitlist_created ON waitlist(created_at);

COMMENT ON TABLE waitlist IS 'Lista de espera para horários indisponíveis';

-- ========================================
-- 5. SERVICE PACKAGES
-- ========================================
CREATE TABLE service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  service_ids uuid[] NOT NULL,
  original_price numeric(10,2) NOT NULL,
  package_price numeric(10,2) NOT NULL,
  discount_percent integer GENERATED ALWAYS AS (
    CASE
      WHEN original_price > 0 THEN
        ROUND(((original_price - package_price) / original_price) * 100)::integer
      ELSE 0
    END
  ) STORED,
  duration_minutes integer NOT NULL,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  CONSTRAINT valid_prices CHECK (package_price > 0 AND package_price <= original_price),
  CONSTRAINT valid_services CHECK (array_length(service_ids, 1) >= 2)
);

CREATE INDEX idx_service_packages_professional ON service_packages(professional_id);
CREATE INDEX idx_service_packages_active ON service_packages(is_active) WHERE is_active = true;
CREATE INDEX idx_service_packages_sort ON service_packages(sort_order);

COMMENT ON TABLE service_packages IS 'Pacotes/combos de serviços com desconto';

-- ========================================
-- 6. LOYALTY CARDS
-- ========================================
CREATE TABLE loyalty_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES imported_contacts(id) ON DELETE CASCADE,
  contact_phone text NOT NULL,
  contact_name text NOT NULL,
  current_stamps integer DEFAULT 0 CHECK (current_stamps >= 0 AND current_stamps < 10),
  total_stamps integer DEFAULT 0 CHECK (total_stamps >= 0),
  rewards_available integer DEFAULT 0 CHECK (rewards_available >= 0),
  rewards_redeemed integer DEFAULT 0 CHECK (rewards_redeemed >= 0),
  card_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(professional_id, contact_id),
  UNIQUE(professional_id, contact_phone)
);

CREATE INDEX idx_loyalty_cards_professional ON loyalty_cards(professional_id);
CREATE INDEX idx_loyalty_cards_contact ON loyalty_cards(contact_id);
CREATE UNIQUE INDEX idx_loyalty_cards_token ON loyalty_cards(card_token);
CREATE INDEX idx_loyalty_cards_active ON loyalty_cards(is_active) WHERE is_active = true;

COMMENT ON TABLE loyalty_cards IS 'Cartões de fidelidade dos clientes';

-- ========================================
-- 7. LOYALTY TRANSACTIONS
-- ========================================
CREATE TABLE loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_card_id uuid REFERENCES loyalty_cards(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('stamp_earned', 'reward_earned', 'reward_redeemed')),
  stamps_change integer NOT NULL,
  notes text,
  created_at timestamp DEFAULT now()
);

CREATE INDEX idx_loyalty_transactions_card ON loyalty_transactions(loyalty_card_id);
CREATE INDEX idx_loyalty_transactions_booking ON loyalty_transactions(booking_id);
CREATE INDEX idx_loyalty_transactions_created ON loyalty_transactions(created_at DESC);

COMMENT ON TABLE loyalty_transactions IS 'Histórico de transações do programa de fidelidade';

-- ========================================
-- 8. CRON LOGS
-- ========================================
CREATE TABLE cron_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'error', 'running')),
  records_processed integer DEFAULT 0,
  records_failed integer DEFAULT 0,
  error_message text,
  execution_time_ms integer,
  metadata jsonb DEFAULT '{}',
  created_at timestamp DEFAULT now()
);

CREATE INDEX idx_cron_logs_job ON cron_logs(job_name);
CREATE INDEX idx_cron_logs_created ON cron_logs(created_at DESC);
CREATE INDEX idx_cron_logs_status ON cron_logs(status);

COMMENT ON TABLE cron_logs IS 'Logs de execução dos cron jobs';

-- ========================================
-- 9. ATUALIZAR TABELA BOOKINGS
-- ========================================
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS reminder_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_sent_at timestamp,
ADD COLUMN IF NOT EXISTS confirmation_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamp,
ADD COLUMN IF NOT EXISTS package_id uuid REFERENCES service_packages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS loyalty_reward_used boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cancelled_reason text,
ADD COLUMN IF NOT EXISTS cancelled_at timestamp;

CREATE INDEX IF NOT EXISTS idx_bookings_reminder_sent ON bookings(reminder_sent) WHERE reminder_sent = false;
CREATE INDEX IF NOT EXISTS idx_bookings_package ON bookings(package_id) WHERE package_id IS NOT NULL;

COMMENT ON COLUMN bookings.reminder_sent IS 'Se lembrete automático foi enviado';
COMMENT ON COLUMN bookings.package_id IS 'Referência ao pacote se booking for de um combo';
COMMENT ON COLUMN bookings.loyalty_reward_used IS 'Se este agendamento usou recompensa de fidelidade';

-- ========================================
-- 10. ROW LEVEL SECURITY (RLS)
-- ========================================

-- Notification Queue
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional pode ver suas notificações"
  ON notification_queue FOR SELECT
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

CREATE POLICY "Sistema pode inserir notificações"
  ON notification_queue FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar notificações"
  ON notification_queue FOR UPDATE
  USING (true);

-- Notification Logs
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional pode ver seus logs"
  ON notification_logs FOR SELECT
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

CREATE POLICY "Sistema pode inserir logs"
  ON notification_logs FOR INSERT
  WITH CHECK (true);

-- Reschedule Tokens (Acesso público via token)
ALTER TABLE reschedule_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso público via token"
  ON reschedule_tokens FOR SELECT
  USING (true);

CREATE POLICY "Sistema pode criar tokens"
  ON reschedule_tokens FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar tokens"
  ON reschedule_tokens FOR UPDATE
  USING (true);

-- Waitlist
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional pode ver sua waitlist"
  ON waitlist FOR SELECT
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

CREATE POLICY "Público pode adicionar na waitlist"
  ON waitlist FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Profissional pode atualizar sua waitlist"
  ON waitlist FOR UPDATE
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

-- Service Packages
ALTER TABLE service_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Público pode ver pacotes ativos"
  ON service_packages FOR SELECT
  USING (is_active = true);

CREATE POLICY "Profissional pode gerenciar seus pacotes"
  ON service_packages FOR ALL
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

-- Loyalty Cards (Acesso público via token)
ALTER TABLE loyalty_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso público via token"
  ON loyalty_cards FOR SELECT
  USING (true);

CREATE POLICY "Profissional pode gerenciar seus cartões"
  ON loyalty_cards FOR ALL
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

-- Loyalty Transactions
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional pode ver transações de seus cartões"
  ON loyalty_transactions FOR SELECT
  USING (loyalty_card_id IN (
    SELECT id FROM loyalty_cards
    WHERE professional_id IN (
      SELECT id FROM professionals WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Sistema pode inserir transações"
  ON loyalty_transactions FOR INSERT
  WITH CHECK (true);

-- Cron Logs (Admin only via service_role)
ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sistema pode gerenciar cron logs"
  ON cron_logs FOR ALL
  USING (true);

-- ========================================
-- 11. TRIGGERS
-- ========================================

-- Trigger: Atualizar updated_at em waitlist
CREATE OR REPLACE FUNCTION update_waitlist_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER waitlist_update_timestamp
BEFORE UPDATE ON waitlist
FOR EACH ROW
EXECUTE FUNCTION update_waitlist_timestamp();

-- Trigger: Atualizar updated_at em loyalty_cards
CREATE OR REPLACE FUNCTION update_loyalty_cards_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER loyalty_cards_update_timestamp
BEFORE UPDATE ON loyalty_cards
FOR EACH ROW
EXECUTE FUNCTION update_loyalty_cards_timestamp();

-- Trigger: Atualizar updated_at em service_packages
CREATE OR REPLACE FUNCTION update_service_packages_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER service_packages_update_timestamp
BEFORE UPDATE ON service_packages
FOR EACH ROW
EXECUTE FUNCTION update_service_packages_timestamp();

-- Trigger: Criar token de reagendamento ao criar booking
CREATE OR REPLACE FUNCTION create_reschedule_token()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO reschedule_tokens (booking_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_create_reschedule_token
AFTER INSERT ON bookings
FOR EACH ROW
EXECUTE FUNCTION create_reschedule_token();

-- Trigger: Notificar waitlist quando booking é cancelado
CREATE OR REPLACE FUNCTION notify_waitlist_on_cancellation()
RETURNS TRIGGER AS $$
DECLARE
  v_waitlist_record RECORD;
  v_professional RECORD;
BEGIN
  -- Só processa se mudou de confirmado para cancelado
  IF OLD.status = 'confirmed' AND NEW.status = 'cancelled' THEN

    -- Busca profissional
    SELECT * INTO v_professional FROM professionals WHERE id = NEW.professional_id;

    -- Busca primeiro da waitlist para este serviço e data
    SELECT * INTO v_waitlist_record
    FROM waitlist
    WHERE professional_id = NEW.professional_id
      AND service_id = NEW.service_id
      AND NEW.booking_date = ANY(preferred_dates)
      AND status = 'active'
      AND notified = false
    ORDER BY created_at ASC
    LIMIT 1;

    -- Se encontrou alguém na waitlist, adiciona na fila de notificações
    IF v_waitlist_record.id IS NOT NULL THEN
      INSERT INTO notification_queue (
        professional_id,
        type,
        recipient_name,
        recipient_phone,
        recipient_email,
        message_template,
        message_data,
        language
      ) VALUES (
        NEW.professional_id,
        'waitlist_available',
        v_waitlist_record.contact_name,
        v_waitlist_record.contact_phone,
        v_waitlist_record.contact_email,
        'waitlist_available',
        jsonb_build_object(
          'waitlist_id', v_waitlist_record.id,
          'booking_date', NEW.booking_date,
          'booking_time', NEW.booking_time,
          'service_id', NEW.service_id,
          'professional_name', v_professional.business_name,
          'professional_slug', v_professional.slug
        ),
        'pt'
      );

      -- Marca waitlist como notificado
      UPDATE waitlist
      SET
        notified = true,
        notified_at = now(),
        notification_expires_at = now() + interval '24 hours',
        status = 'notified'
      WHERE id = v_waitlist_record.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_notify_waitlist
AFTER UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION notify_waitlist_on_cancellation();

-- Trigger: Adicionar carimbo quando booking é completado
CREATE OR REPLACE FUNCTION add_loyalty_stamp_on_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_loyalty_card RECORD;
  v_new_stamps integer;
  v_new_rewards integer;
BEGIN
  -- Só processa se mudou para completed
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN

    -- Busca ou cria cartão de fidelidade
    INSERT INTO loyalty_cards (
      professional_id,
      contact_id,
      contact_phone,
      contact_name,
      current_stamps,
      total_stamps
    ) VALUES (
      NEW.professional_id,
      NEW.contact_id,
      NEW.contact_phone,
      NEW.contact_name,
      1,
      1
    )
    ON CONFLICT (professional_id, contact_phone)
    DO UPDATE SET
      current_stamps = loyalty_cards.current_stamps + 1,
      total_stamps = loyalty_cards.total_stamps + 1,
      updated_at = now()
    RETURNING * INTO v_loyalty_card;

    -- Calcula quantas recompensas deve ganhar
    v_new_rewards := (v_loyalty_card.current_stamps / 10)::integer;

    -- Se ganhou recompensa(s)
    IF v_new_rewards > 0 THEN
      -- Atualiza cartão
      UPDATE loyalty_cards
      SET
        current_stamps = v_loyalty_card.current_stamps % 10,
        rewards_available = rewards_available + v_new_rewards,
        updated_at = now()
      WHERE id = v_loyalty_card.id;

      -- Registra ganho de recompensa
      INSERT INTO loyalty_transactions (
        loyalty_card_id,
        booking_id,
        type,
        stamps_change,
        notes
      ) VALUES (
        v_loyalty_card.id,
        NEW.id,
        'reward_earned',
        v_new_rewards,
        format('Ganhou %s recompensa(s)!', v_new_rewards)
      );

      -- Adiciona notificação de recompensa disponível
      INSERT INTO notification_queue (
        professional_id,
        type,
        recipient_name,
        recipient_phone,
        recipient_email,
        message_template,
        message_data,
        language
      ) VALUES (
        NEW.professional_id,
        'loyalty_reward',
        NEW.contact_name,
        NEW.contact_phone,
        NEW.contact_email,
        'loyalty_reward_earned',
        jsonb_build_object(
          'rewards_count', v_new_rewards,
          'card_token', v_loyalty_card.card_token
        ),
        'pt'
      );
    END IF;

    -- Registra transação de carimbo
    INSERT INTO loyalty_transactions (
      loyalty_card_id,
      booking_id,
      type,
      stamps_change,
      notes
    ) VALUES (
      v_loyalty_card.id,
      NEW.id,
      'stamp_earned',
      1,
      'Carimbo ganho por serviço completado'
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_add_loyalty_stamp
AFTER UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION add_loyalty_stamp_on_completion();

-- ========================================
-- 12. FUNÇÕES AUXILIARES
-- ========================================

-- Função: Buscar horários disponíveis considerando pacotes
CREATE OR REPLACE FUNCTION get_available_slots(
  p_professional_id uuid,
  p_date date,
  p_duration_minutes integer
)
RETURNS TABLE (
  time_slot time,
  is_available boolean
) AS $$
BEGIN
  RETURN QUERY
  WITH all_slots AS (
    SELECT generate_series(
      '09:00'::time,
      '18:00'::time,
      '30 minutes'::interval
    )::time AS slot
  ),
  booked_slots AS (
    SELECT
      booking_time,
      CASE
        WHEN b.package_id IS NOT NULL THEN
          (SELECT duration_minutes FROM service_packages WHERE id = b.package_id)
        ELSE
          (SELECT duration_minutes FROM services WHERE id = b.service_id)
      END as duration
    FROM bookings b
    WHERE b.professional_id = p_professional_id
      AND b.booking_date = p_date
      AND b.status IN ('pending', 'confirmed')
  )
  SELECT
    s.slot,
    NOT EXISTS (
      SELECT 1 FROM booked_slots bs
      WHERE s.slot >= bs.booking_time
        AND s.slot < bs.booking_time + (bs.duration || ' minutes')::interval
    ) as is_available
  FROM all_slots s
  ORDER BY s.slot;
END;
$$ LANGUAGE plpgsql;

-- Função: Cleanup de tokens expirados
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS integer AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM reschedule_tokens
  WHERE expires_at < now()
    AND used = false;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Função: Expirar waitlist não respondidos
CREATE OR REPLACE FUNCTION expire_unresponsive_waitlist()
RETURNS integer AS $$
DECLARE
  v_expired_count integer;
BEGIN
  UPDATE waitlist
  SET status = 'expired'
  WHERE status = 'notified'
    AND notification_expires_at < now();

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- FIM DA MIGRATION
-- ========================================
