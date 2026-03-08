-- =====================================================
-- SPRINT 8 - FASE 2: Integrações Avançadas
-- Data: 2026-02-17
-- Integrações: Google Maps, Email Marketing, Instagram, Revolut
-- =====================================================

-- =====================================================
-- 1. GOOGLE MAPS - Adicionar campos de localização
-- =====================================================

-- Adicionar campos de endereço e geolocalização em professionals
ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS city text DEFAULT 'Dublin',
ADD COLUMN IF NOT EXISTS postal_code text,
ADD COLUMN IF NOT EXISTS country text DEFAULT 'Ireland',
ADD COLUMN IF NOT EXISTS latitude numeric(10, 8),
ADD COLUMN IF NOT EXISTS longitude numeric(11, 8),
ADD COLUMN IF NOT EXISTS google_place_id text;

-- Índice para buscas por localização
CREATE INDEX IF NOT EXISTS idx_professionals_location
ON professionals(latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Comentários
COMMENT ON COLUMN professionals.address IS 'Endereço completo do profissional';
COMMENT ON COLUMN professionals.latitude IS 'Latitude para Google Maps (formato: 53.349805)';
COMMENT ON COLUMN professionals.longitude IS 'Longitude para Google Maps (formato: -6.260310)';
COMMENT ON COLUMN professionals.google_place_id IS 'Google Place ID para integração com Google Maps API';

-- =====================================================
-- 2. EMAIL MARKETING - Sistema completo de campanhas
-- =====================================================

-- Tabela principal de campanhas de email
CREATE TABLE IF NOT EXISTS email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE NOT NULL,

  -- Dados básicos da campanha
  name text NOT NULL,
  subject text NOT NULL,
  from_name text NOT NULL,
  from_email text NOT NULL,
  reply_to text,

  -- Segmentação de destinatários
  target_segment text NOT NULL DEFAULT 'all', -- 'all', 'new', 'occasional', 'recurring', 'inactive', 'custom'

  -- Filtros customizados (JSON)
  custom_filters jsonb DEFAULT '{}', -- { "min_bookings": 5, "last_visit_days": 30 }

  -- Template e conteúdo
  template_type text NOT NULL DEFAULT 'custom', -- 'promotion', 'newsletter', 'follow_up', 'custom'
  html_content text NOT NULL,
  text_content text, -- Versão texto puro (fallback)

  -- Variáveis dinâmicas disponíveis
  -- [CLIENT_NAME], [SERVICE_NAME], [PRICE], [BOOKING_LINK], [PROFESSIONAL_NAME]

  -- Agendamento
  scheduled_for timestamp,
  sent_at timestamp,

  -- Estatísticas (atualizadas via Resend webhooks)
  total_recipients integer DEFAULT 0,
  total_sent integer DEFAULT 0,
  total_delivered integer DEFAULT 0,
  total_opened integer DEFAULT 0,
  total_clicked integer DEFAULT 0,
  total_bounced integer DEFAULT 0,
  total_complained integer DEFAULT 0,

  -- Taxa de conversão
  open_rate numeric(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_delivered > 0
    THEN ROUND((total_opened::numeric / total_delivered::numeric) * 100, 2)
    ELSE 0 END
  ) STORED,

  click_rate numeric(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_delivered > 0
    THEN ROUND((total_clicked::numeric / total_delivered::numeric) * 100, 2)
    ELSE 0 END
  ) STORED,

  -- Status da campanha
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),

  -- Metadata
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_email_campaigns_professional ON email_campaigns(professional_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_scheduled ON email_campaigns(scheduled_for) WHERE scheduled_for IS NOT NULL;

-- Tabela de destinatários individuais (para tracking granular)
CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES email_campaigns(id) ON DELETE CASCADE NOT NULL,

  -- Destinatário
  contact_email text NOT NULL,
  contact_name text,
  contact_phone text,

  -- Resend Message ID
  resend_message_id text UNIQUE,

  -- Status individual
  sent_at timestamp,
  delivered_at timestamp,
  opened_at timestamp,
  clicked_at timestamp,
  bounced_at timestamp,
  complained_at timestamp,

  -- Dados personalizados usados no email
  personalization_data jsonb DEFAULT '{}',

  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_recipients_campaign ON email_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_recipients_message_id ON email_campaign_recipients(resend_message_id);

-- RLS Policies
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_recipients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Profissional pode ver suas campanhas' AND tablename = 'email_campaigns') THEN
    CREATE POLICY "Profissional pode ver suas campanhas" ON email_campaigns FOR SELECT USING (professional_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Profissional pode criar campanhas' AND tablename = 'email_campaigns') THEN
    CREATE POLICY "Profissional pode criar campanhas" ON email_campaigns FOR INSERT WITH CHECK (professional_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Profissional pode atualizar suas campanhas' AND tablename = 'email_campaigns') THEN
    CREATE POLICY "Profissional pode atualizar suas campanhas" ON email_campaigns FOR UPDATE USING (professional_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Profissional pode deletar suas campanhas' AND tablename = 'email_campaigns') THEN
    CREATE POLICY "Profissional pode deletar suas campanhas" ON email_campaigns FOR DELETE USING (professional_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Profissional pode ver destinatários de suas campanhas' AND tablename = 'email_campaign_recipients') THEN
    CREATE POLICY "Profissional pode ver destinatários de suas campanhas" ON email_campaign_recipients FOR SELECT USING (campaign_id IN (SELECT id FROM email_campaigns WHERE professional_id = auth.uid()));
  END IF;
END $$;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_email_campaign_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'email_campaigns_updated_at') THEN
    CREATE TRIGGER email_campaigns_updated_at BEFORE UPDATE ON email_campaigns FOR EACH ROW EXECUTE FUNCTION update_email_campaign_updated_at();
  END IF;
END $$;

-- =====================================================
-- 3. INSTAGRAM - Automação de posts e stories
-- =====================================================

-- Adicionar campo Instagram handle em professionals
ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS instagram_handle text,
ADD COLUMN IF NOT EXISTS instagram_user_id text,
ADD COLUMN IF NOT EXISTS instagram_bio text;

-- Índice para busca por handle
CREATE INDEX IF NOT EXISTS idx_professionals_instagram
ON professionals(instagram_handle)
WHERE instagram_handle IS NOT NULL;

-- Tabela de posts do Instagram
CREATE TABLE IF NOT EXISTS instagram_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE NOT NULL,
  integration_id uuid REFERENCES integrations(id) ON DELETE SET NULL,

  -- Tipo de post
  post_type text NOT NULL CHECK (post_type IN ('feed', 'story', 'reel')),

  -- Conteúdo
  caption text,
  image_url text NOT NULL,

  -- Link para agendamento (stories com 10K+ followers)
  booking_link text,

  -- Resposta da API do Instagram
  instagram_media_id text UNIQUE,
  permalink text,

  -- Trigger que disparou o post
  trigger_type text CHECK (trigger_type IN ('manual', 'auto_vacancy', 'scheduled', 'gallery_sync')),
  trigger_data jsonb DEFAULT '{}', -- { "booking_id": "...", "service_id": "..." }

  -- Estatísticas (via Instagram Graph API)
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  saves_count integer DEFAULT 0,
  reach integer DEFAULT 0,
  impressions integer DEFAULT 0,

  -- Engajamento calculado
  engagement_rate numeric(5,2) GENERATED ALWAYS AS (
    CASE WHEN reach > 0
    THEN ROUND(((likes_count + comments_count + saves_count)::numeric / reach::numeric) * 100, 2)
    ELSE 0 END
  ) STORED,

  -- Status
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'failed')),
  error_message text,

  -- Timestamps
  posted_at timestamp DEFAULT now(),
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instagram_posts_professional ON instagram_posts(professional_id);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_type ON instagram_posts(post_type);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_status ON instagram_posts(status);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_trigger ON instagram_posts(trigger_type);

-- RLS
ALTER TABLE instagram_posts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Profissional pode gerenciar seus posts no Instagram' AND tablename = 'instagram_posts') THEN
    CREATE POLICY "Profissional pode gerenciar seus posts no Instagram" ON instagram_posts FOR ALL USING (professional_id = auth.uid());
  END IF;
END $$;

-- Trigger: Auto-post no Instagram quando cancelar booking (vaga disponível)
CREATE OR REPLACE FUNCTION auto_post_instagram_on_vacancy()
RETURNS TRIGGER AS $$
DECLARE
  v_integration_active boolean;
  v_service_name text;
  v_booking_time time;
BEGIN
  -- Verificar se integração Instagram está ativa
  SELECT is_active INTO v_integration_active
  FROM integrations
  WHERE professional_id = OLD.professional_id
    AND type = 'instagram'
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND OR NOT v_integration_active THEN
    RETURN OLD;
  END IF;

  -- Buscar dados do serviço
  SELECT name INTO v_service_name
  FROM services
  WHERE id = OLD.service_id;

  v_booking_time := OLD.booking_date::time;

  -- Adicionar à fila de posts
  INSERT INTO instagram_posts (
    professional_id,
    integration_id,
    post_type,
    caption,
    image_url,
    trigger_type,
    trigger_data,
    status
  )
  SELECT
    OLD.professional_id,
    id,
    'story',
    format('🎉 Vaga Disponível! %s às %s. Link na bio para agendar!', v_service_name, v_booking_time),
    'https://circlehood-booking.vercel.app/api/og/vacancy?service=' || v_service_name || '&time=' || v_booking_time,
    'auto_vacancy',
    jsonb_build_object(
      'booking_id', OLD.id,
      'service_id', OLD.service_id,
      'date', OLD.booking_date
    ),
    'pending'
  FROM integrations
  WHERE professional_id = OLD.professional_id
    AND type = 'instagram'
    AND is_active = true
  LIMIT 1;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger só dispara em cancelamentos (não em deleções)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'instagram_auto_post_vacancy') THEN
    CREATE TRIGGER instagram_auto_post_vacancy AFTER UPDATE OF status ON bookings FOR EACH ROW WHEN (OLD.status != 'cancelled' AND NEW.status = 'cancelled') EXECUTE FUNCTION auto_post_instagram_on_vacancy();
  END IF;
END $$;

-- =====================================================
-- 4. REVOLUT - Sistema de pagamentos alternativo
-- =====================================================

-- Tabela de pagamentos Revolut
CREATE TABLE IF NOT EXISTS revolut_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE NOT NULL,

  -- IDs Revolut
  revolut_order_id text UNIQUE NOT NULL,
  merchant_order_ref text UNIQUE NOT NULL, -- Nossa referência interna

  -- Dados do pagamento
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'EUR' NOT NULL,
  description text,

  -- Cliente
  customer_email text,
  customer_name text,

  -- Checkout
  checkout_url text,

  -- Status
  status text DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'authorised', 'completed', 'cancelled', 'failed', 'refunded'
  )),

  -- Datas importantes
  authorised_at timestamp,
  completed_at timestamp,
  cancelled_at timestamp,

  -- Metadata
  metadata jsonb DEFAULT '{}',

  -- Webhook events (histórico)
  webhook_events jsonb DEFAULT '[]',

  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revolut_payments_professional ON revolut_payments(professional_id);
CREATE INDEX IF NOT EXISTS idx_revolut_payments_order ON revolut_payments(revolut_order_id);
CREATE INDEX IF NOT EXISTS idx_revolut_payments_status ON revolut_payments(status);

-- RLS
ALTER TABLE revolut_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Profissional pode ver seus pagamentos Revolut' AND tablename = 'revolut_payments') THEN
    CREATE POLICY "Profissional pode ver seus pagamentos Revolut" ON revolut_payments FOR SELECT USING (professional_id = auth.uid());
  END IF;
END $$;

-- Adicionar preferência de pagamento em professionals
ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS payment_provider text DEFAULT 'stripe' CHECK (payment_provider IN ('stripe', 'revolut', 'both')),
ADD COLUMN IF NOT EXISTS revolut_merchant_id text;

-- Trigger para atualizar updated_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'revolut_payments_updated_at') THEN
    CREATE TRIGGER revolut_payments_updated_at BEFORE UPDATE ON revolut_payments FOR EACH ROW EXECUTE FUNCTION update_email_campaign_updated_at();
  END IF;
END $$;

-- =====================================================
-- 5. Atualizar tabela integrations com novos tipos
-- =====================================================

-- Adicionar check constraint para novos tipos
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_type_check;
ALTER TABLE integrations ADD CONSTRAINT integrations_type_check
  CHECK (type IN ('google_calendar', 'whatsapp', 'instagram', 'email', 'revolut'));

-- Adicionar campos específicos para cada integração
ALTER TABLE integrations
ADD COLUMN IF NOT EXISTS instagram_user_id text,
ADD COLUMN IF NOT EXISTS instagram_username text,
ADD COLUMN IF NOT EXISTS revolut_merchant_id text,
ADD COLUMN IF NOT EXISTS email_from_name text,
ADD COLUMN IF NOT EXISTS email_from_email text;

-- =====================================================
-- 6. Views úteis para analytics
-- =====================================================

-- Views removed: email_campaign_performance and instagram_performance
-- These reference generated columns that may not exist on the actual table.
-- Migration 20260305000001_drop_broken_views.sql drops them later anyway.

-- =====================================================
-- 7. Funções utilitárias
-- =====================================================

-- Função: Buscar contatos por segmento para email
CREATE OR REPLACE FUNCTION get_contacts_by_segment(
  p_professional_id uuid,
  p_segment text,
  p_custom_filters jsonb DEFAULT '{}'
)
RETURNS TABLE (
  contact_id uuid,
  name text,
  email text,
  phone text,
  last_booking_date timestamp,
  total_bookings bigint,
  classification text
) AS $$
BEGIN
  RETURN QUERY
  WITH contact_stats AS (
    SELECT
      c.id,
      c.name,
      c.email,
      c.phone,
      MAX(b.booking_date) as last_booking,
      COUNT(b.id) as booking_count
    FROM contacts c
    LEFT JOIN bookings b ON b.contact_phone = c.phone AND b.professional_id = p_professional_id
    WHERE c.professional_id = p_professional_id
      AND c.email IS NOT NULL
      AND c.email != ''
    GROUP BY c.id, c.name, c.email, c.phone
  )
  SELECT
    cs.id,
    cs.name,
    cs.email,
    cs.phone,
    cs.last_booking,
    cs.booking_count,
    CASE
      WHEN cs.booking_count = 0 THEN 'new'
      WHEN cs.booking_count BETWEEN 1 AND 3 THEN 'occasional'
      WHEN cs.booking_count > 3 AND cs.last_booking > NOW() - INTERVAL '90 days' THEN 'recurring'
      ELSE 'inactive'
    END as client_type
  FROM contact_stats cs
  WHERE
    CASE p_segment
      WHEN 'all' THEN true
      WHEN 'new' THEN cs.booking_count = 0
      WHEN 'occasional' THEN cs.booking_count BETWEEN 1 AND 3
      WHEN 'recurring' THEN cs.booking_count > 3 AND cs.last_booking > NOW() - INTERVAL '90 days'
      WHEN 'inactive' THEN cs.last_booking < NOW() - INTERVAL '90 days'
      ELSE true
    END;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 8. Seed data - Templates de email prontos
-- =====================================================

-- Inserir templates de exemplo (comentado para não duplicar em re-runs)
/*
INSERT INTO email_campaigns (
  professional_id,
  name,
  subject,
  from_name,
  from_email,
  template_type,
  html_content,
  status
) VALUES (
  (SELECT id FROM professionals LIMIT 1),
  'Template: Promoção',
  '🎉 Promoção Especial para Você!',
  'CircleHood',
  'noreply@circlehood.app',
  'promotion',
  '<html>...</html>',
  'draft'
);
*/

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================

-- Comentários finais
COMMENT ON TABLE email_campaigns IS 'Campanhas de email marketing para clientes';
COMMENT ON TABLE instagram_posts IS 'Posts automatizados no Instagram (feed, stories, reels)';
COMMENT ON TABLE revolut_payments IS 'Pagamentos processados via Revolut como alternativa ao Stripe';
