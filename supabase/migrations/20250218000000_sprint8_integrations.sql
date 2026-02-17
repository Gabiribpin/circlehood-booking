-- ========================================
-- SPRINT 8: INTEGRAÇÕES - Google Calendar, WhatsApp API, Instagram, Email Marketing
-- Data: 18 de Fevereiro de 2026
-- ========================================

-- 1. Tabela de configurações de integrações
CREATE TABLE integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,

  -- Tipo de integração
  integration_type text NOT NULL,
  -- 'google_calendar', 'whatsapp_api', 'instagram', 'email_marketing', 'revolut', 'google_maps'

  -- Status
  is_active boolean DEFAULT true,
  is_configured boolean DEFAULT false,

  -- Credenciais encriptadas (JSON)
  credentials jsonb NOT NULL DEFAULT '{}',

  -- Configurações específicas (JSON)
  settings jsonb DEFAULT '{}',

  -- Metadata de sincronização
  last_sync_at timestamptz,
  sync_frequency text DEFAULT 'realtime', -- 'realtime', 'hourly', 'daily'

  -- Logs de erro
  last_error text,
  error_count integer DEFAULT 0,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(professional_id, integration_type)
);

CREATE INDEX idx_integrations_professional ON integrations(professional_id);
CREATE INDEX idx_integrations_type ON integrations(integration_type);
CREATE INDEX idx_integrations_active ON integrations(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional gerencia suas integrações"
  ON integrations FOR ALL
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

-- ========================================
-- 2. Eventos do Google Calendar (cache local)
-- ========================================

CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,

  -- Referência ao booking (se aplicável)
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,

  -- Google Calendar IDs
  google_event_id text UNIQUE,
  google_calendar_id text,

  -- Dados do evento
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  location text,

  -- Status
  status text DEFAULT 'confirmed', -- 'confirmed', 'tentative', 'cancelled'

  -- Fonte do evento
  source text NOT NULL, -- 'circlehood', 'google', 'manual'

  -- Sincronização
  synced_to_google boolean DEFAULT false,
  last_synced_at timestamptz,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_calendar_events_professional ON calendar_events(professional_id);
CREATE INDEX idx_calendar_events_booking ON calendar_events(booking_id);
CREATE INDEX idx_calendar_events_google_id ON calendar_events(google_event_id);
CREATE INDEX idx_calendar_events_time ON calendar_events(start_time, end_time);

-- RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional vê seus eventos"
  ON calendar_events FOR SELECT
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

CREATE POLICY "Profissional gerencia seus eventos"
  ON calendar_events FOR ALL
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

-- ========================================
-- 3. Mensagens WhatsApp (log de envios)
-- ========================================

CREATE TABLE whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,

  -- Destinatário
  recipient_phone text NOT NULL,
  recipient_name text,

  -- Referências
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,

  -- Conteúdo
  message_type text NOT NULL, -- 'text', 'template', 'media'
  message_content text NOT NULL,
  template_name text, -- Nome do template aprovado no WhatsApp

  -- WhatsApp API
  whatsapp_message_id text UNIQUE,

  -- Status
  status text DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'read', 'failed'
  error_message text,

  -- Timestamps
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_whatsapp_messages_professional ON whatsapp_messages(professional_id);
CREATE INDEX idx_whatsapp_messages_recipient ON whatsapp_messages(recipient_phone);
CREATE INDEX idx_whatsapp_messages_booking ON whatsapp_messages(booking_id);
CREATE INDEX idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX idx_whatsapp_messages_created ON whatsapp_messages(created_at DESC);

-- RLS
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional vê suas mensagens WhatsApp"
  ON whatsapp_messages FOR SELECT
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

-- ========================================
-- 4. Posts do Instagram
-- ========================================

CREATE TABLE instagram_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,

  -- Conteúdo
  caption text NOT NULL,
  image_url text,
  post_type text DEFAULT 'feed', -- 'feed', 'story', 'reel'

  -- Instagram API
  instagram_post_id text UNIQUE,

  -- Status
  status text DEFAULT 'draft', -- 'draft', 'scheduled', 'published', 'failed'
  scheduled_for timestamptz,
  published_at timestamptz,

  -- Engajamento (atualizado via webhook)
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,

  -- Erro
  error_message text,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_instagram_posts_professional ON instagram_posts(professional_id);
CREATE INDEX idx_instagram_posts_status ON instagram_posts(status);
CREATE INDEX idx_instagram_posts_published ON instagram_posts(published_at DESC);

-- RLS
ALTER TABLE instagram_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional gerencia seus posts Instagram"
  ON instagram_posts FOR ALL
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

-- ========================================
-- 5. Campanhas de Email Marketing
-- ========================================

CREATE TABLE email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,

  -- Dados da campanha
  name text NOT NULL,
  subject text NOT NULL,
  preview_text text,

  -- Conteúdo
  html_content text NOT NULL,

  -- Segmentação
  target_segment text, -- 'all', 'new_clients', 'inactive', 'vip'
  target_contacts uuid[], -- IDs específicos de imported_contacts

  -- Provider
  email_provider text DEFAULT 'resend', -- 'resend', 'sendgrid'
  provider_campaign_id text,

  -- Status
  status text DEFAULT 'draft', -- 'draft', 'scheduled', 'sending', 'sent', 'failed'
  scheduled_for timestamptz,
  sent_at timestamptz,

  -- Estatísticas
  total_recipients integer DEFAULT 0,
  total_sent integer DEFAULT 0,
  total_delivered integer DEFAULT 0,
  total_opened integer DEFAULT 0,
  total_clicked integer DEFAULT 0,
  total_bounced integer DEFAULT 0,
  total_unsubscribed integer DEFAULT 0,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_email_campaigns_professional ON email_campaigns(professional_id);
CREATE INDEX idx_email_campaigns_status ON email_campaigns(status);

-- RLS
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional gerencia campanhas email"
  ON email_campaigns FOR ALL
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

-- ========================================
-- 6. Atualizar tabela professionals
-- ========================================

-- Google Maps
ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS latitude numeric(10, 7),
ADD COLUMN IF NOT EXISTS longitude numeric(10, 7),
ADD COLUMN IF NOT EXISTS google_place_id text;

-- Redes sociais
ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS instagram_handle text,
ADD COLUMN IF NOT EXISTS facebook_page_id text,
ADD COLUMN IF NOT EXISTS google_calendar_id text,
ADD COLUMN IF NOT EXISTS whatsapp_business_id text;

-- Métodos de pagamento
ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS payment_methods jsonb DEFAULT '{"stripe": true, "revolut": false}';

CREATE INDEX idx_professionals_location ON professionals(latitude, longitude)
  WHERE latitude IS NOT NULL;

CREATE INDEX idx_professionals_instagram ON professionals(instagram_handle)
  WHERE instagram_handle IS NOT NULL;

-- ========================================
-- 7. Trigger: Sincronizar booking com Google Calendar
-- ========================================

CREATE OR REPLACE FUNCTION sync_booking_to_calendar()
RETURNS TRIGGER AS $$
DECLARE
  v_professional_id uuid;
  v_service_name text;
  v_event_title text;
BEGIN
  -- Buscar professional_id e service_name
  SELECT b.professional_id, s.name
  INTO v_professional_id, v_service_name
  FROM bookings b
  LEFT JOIN services s ON s.id = b.service_id
  WHERE b.id = NEW.id;

  -- Criar título do evento
  v_event_title := COALESCE(v_service_name, 'Agendamento') || ' - ' || NEW.contact_name;

  -- Inserir ou atualizar evento no calendar_events
  INSERT INTO calendar_events (
    professional_id,
    booking_id,
    title,
    description,
    start_time,
    end_time,
    location,
    source,
    synced_to_google
  )
  VALUES (
    v_professional_id,
    NEW.id,
    v_event_title,
    'Cliente: ' || NEW.contact_name || E'\nTelefone: ' || NEW.contact_phone,
    (NEW.booking_date::date + NEW.booking_time::time)::timestamptz,
    (NEW.booking_date::date + NEW.booking_time::time + INTERVAL '1 hour')::timestamptz,
    NEW.location,
    'circlehood',
    false -- Será sincronizado por cron job ou webhook
  )
  ON CONFLICT (booking_id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    synced_to_google = false,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_sync_calendar_trigger
AFTER INSERT OR UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION sync_booking_to_calendar();

-- ========================================
-- 8. Função: Detectar conflitos de horário
-- ========================================

CREATE OR REPLACE FUNCTION check_calendar_conflicts(
  p_professional_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS TABLE(
  conflict_type text,
  conflict_source text,
  event_title text,
  event_start timestamptz,
  event_end timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    'booking_conflict'::text,
    'circlehood'::text,
    b.contact_name,
    (b.booking_date::date + b.booking_time::time)::timestamptz,
    (b.booking_date::date + b.booking_time::time + INTERVAL '1 hour')::timestamptz
  FROM bookings b
  WHERE b.professional_id = p_professional_id
    AND b.status IN ('confirmed', 'pending')
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
    AND (
      (b.booking_date::date + b.booking_time::time)::timestamptz < p_end_time
      AND (b.booking_date::date + b.booking_time::time + INTERVAL '1 hour')::timestamptz > p_start_time
    )

  UNION ALL

  SELECT
    'calendar_conflict'::text,
    ce.source::text,
    ce.title,
    ce.start_time,
    ce.end_time
  FROM calendar_events ce
  WHERE ce.professional_id = p_professional_id
    AND ce.status = 'confirmed'
    AND ce.booking_id IS NULL -- Eventos externos
    AND ce.start_time < p_end_time
    AND ce.end_time > p_start_time;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- FIM DA MIGRATION SPRINT 8
-- ========================================

-- Inserir log de migration
INSERT INTO cron_logs (job_name, status, records_processed, metadata)
VALUES (
  'sprint8_migration',
  'success',
  5,
  '{"tables_created": ["integrations", "calendar_events", "whatsapp_messages", "instagram_posts", "email_campaigns"], "version": "20250218000000"}'
);
