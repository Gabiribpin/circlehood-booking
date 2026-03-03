-- =====================================================
-- RESTO DA MIGRATION: Email, Revolut, Google Maps
-- =====================================================

-- =====================================================
-- 1. GOOGLE MAPS - Campos de localização
-- =====================================================

ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS city text DEFAULT 'Dublin',
ADD COLUMN IF NOT EXISTS postal_code text,
ADD COLUMN IF NOT EXISTS country text DEFAULT 'Ireland',
ADD COLUMN IF NOT EXISTS latitude numeric(10, 8),
ADD COLUMN IF NOT EXISTS longitude numeric(11, 8),
ADD COLUMN IF NOT EXISTS google_place_id text;

CREATE INDEX IF NOT EXISTS idx_professionals_location
ON professionals(latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- =====================================================
-- 2. INSTAGRAM - Campos em professionals
-- =====================================================

ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS instagram_handle text,
ADD COLUMN IF NOT EXISTS instagram_user_id text,
ADD COLUMN IF NOT EXISTS instagram_bio text;

CREATE INDEX IF NOT EXISTS idx_professionals_instagram
ON professionals(instagram_handle)
WHERE instagram_handle IS NOT NULL;

-- =====================================================
-- 3. EMAIL MARKETING - Sistema de campanhas
-- =====================================================

CREATE TABLE IF NOT EXISTS email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  from_name text NOT NULL,
  from_email text NOT NULL,
  reply_to text,
  target_segment text NOT NULL DEFAULT 'all',
  custom_filters jsonb DEFAULT '{}',
  template_type text NOT NULL DEFAULT 'custom',
  html_content text NOT NULL,
  text_content text,
  scheduled_for timestamp,
  sent_at timestamp,
  total_recipients integer DEFAULT 0,
  total_sent integer DEFAULT 0,
  total_delivered integer DEFAULT 0,
  total_opened integer DEFAULT 0,
  total_clicked integer DEFAULT 0,
  total_bounced integer DEFAULT 0,
  total_complained integer DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_professional ON email_campaigns(professional_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES email_campaigns(id) ON DELETE CASCADE NOT NULL,
  contact_email text NOT NULL,
  contact_name text,
  resend_message_id text UNIQUE,
  sent_at timestamp,
  delivered_at timestamp,
  opened_at timestamp,
  clicked_at timestamp,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_recipients_campaign ON email_campaign_recipients(campaign_id);

ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profissional pode ver suas campanhas" ON email_campaigns;
CREATE POLICY "Profissional pode ver suas campanhas"
  ON email_campaigns FOR SELECT USING (professional_id = auth.uid());

DROP POLICY IF EXISTS "Profissional pode criar campanhas" ON email_campaigns;
CREATE POLICY "Profissional pode criar campanhas"
  ON email_campaigns FOR INSERT WITH CHECK (professional_id = auth.uid());

DROP POLICY IF EXISTS "Profissional pode atualizar suas campanhas" ON email_campaigns;
CREATE POLICY "Profissional pode atualizar suas campanhas"
  ON email_campaigns FOR UPDATE USING (professional_id = auth.uid());

DROP POLICY IF EXISTS "Profissional pode deletar suas campanhas" ON email_campaigns;
CREATE POLICY "Profissional pode deletar suas campanhas"
  ON email_campaigns FOR DELETE USING (professional_id = auth.uid());

DROP POLICY IF EXISTS "Profissional pode ver destinatários" ON email_campaign_recipients;
CREATE POLICY "Profissional pode ver destinatários"
  ON email_campaign_recipients FOR SELECT
  USING (campaign_id IN (SELECT id FROM email_campaigns WHERE professional_id = auth.uid()));

CREATE OR REPLACE FUNCTION update_email_campaign_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_campaigns_updated_at ON email_campaigns;
CREATE TRIGGER email_campaigns_updated_at
  BEFORE UPDATE ON email_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_email_campaign_updated_at();

-- =====================================================
-- 4. REVOLUT - Pagamentos
-- =====================================================

CREATE TABLE IF NOT EXISTS revolut_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE NOT NULL,
  revolut_order_id text UNIQUE NOT NULL,
  merchant_order_ref text UNIQUE NOT NULL,
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'EUR' NOT NULL,
  description text,
  customer_email text,
  checkout_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'authorised', 'completed', 'cancelled', 'failed', 'refunded')),
  completed_at timestamp,
  metadata jsonb DEFAULT '{}',
  webhook_events jsonb DEFAULT '[]',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revolut_payments_professional ON revolut_payments(professional_id);
CREATE INDEX IF NOT EXISTS idx_revolut_payments_order ON revolut_payments(revolut_order_id);

ALTER TABLE revolut_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profissional pode ver seus pagamentos Revolut" ON revolut_payments;
CREATE POLICY "Profissional pode ver seus pagamentos Revolut"
  ON revolut_payments FOR SELECT USING (professional_id = auth.uid());

ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS payment_provider text DEFAULT 'stripe' CHECK (payment_provider IN ('stripe', 'revolut', 'both')),
ADD COLUMN IF NOT EXISTS revolut_merchant_id text;

DROP TRIGGER IF EXISTS revolut_payments_updated_at ON revolut_payments;
CREATE TRIGGER revolut_payments_updated_at
  BEFORE UPDATE ON revolut_payments
  FOR EACH ROW EXECUTE FUNCTION update_email_campaign_updated_at();

-- =====================================================
-- 5. Função de segmentação
-- =====================================================

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

-- FIM
