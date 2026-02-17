-- =====================================================
-- DROPAR E RECRIAR TABELA INTEGRATIONS
-- =====================================================

-- 1. DROPAR TUDO relacionado a integrations
DROP TABLE IF EXISTS integrations CASCADE;
DROP FUNCTION IF EXISTS update_integrations_updated_at() CASCADE;

-- 2. RECRIAR TABELA COMPLETA
CREATE TABLE integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE NOT NULL,

  -- Tipo de integração
  type text NOT NULL CHECK (type IN ('google_calendar', 'whatsapp', 'instagram', 'email', 'revolut')),

  -- Credenciais OAuth
  access_token text,
  refresh_token text,
  token_expires_at timestamp,

  -- Status
  is_active boolean DEFAULT true,

  -- Última sincronização
  last_sync_at timestamp,
  last_error text,

  -- Configurações específicas
  settings jsonb DEFAULT '{}',

  -- Google Calendar
  google_calendar_id text,

  -- Instagram
  instagram_user_id text,
  instagram_username text,

  -- Revolut
  revolut_merchant_id text,

  -- Email
  email_from_name text,
  email_from_email text,

  -- Metadata
  metadata jsonb DEFAULT '{}',

  -- Timestamps
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),

  -- Uma integração de cada tipo por profissional
  UNIQUE(professional_id, type)
);

-- 3. ÍNDICES
CREATE INDEX idx_integrations_professional ON integrations(professional_id);
CREATE INDEX idx_integrations_type ON integrations(type);
CREATE INDEX idx_integrations_active ON integrations(is_active) WHERE is_active = true;

-- 4. RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional pode ver suas integrações"
  ON integrations FOR SELECT
  USING (professional_id = auth.uid());

CREATE POLICY "Profissional pode criar integrações"
  ON integrations FOR INSERT
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Profissional pode atualizar suas integrações"
  ON integrations FOR UPDATE
  USING (professional_id = auth.uid());

CREATE POLICY "Profissional pode deletar suas integrações"
  ON integrations FOR DELETE
  USING (professional_id = auth.uid());

-- 5. TRIGGER
CREATE OR REPLACE FUNCTION update_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_integrations_updated_at();

-- FIM - Agora execute o RESTO.sql
