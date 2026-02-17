-- =====================================================
-- CRIAR TABELA INTEGRATIONS (estava faltando)
-- Execute ANTES do RESTO.sql
-- =====================================================

-- Criar tabela de integrações
CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE NOT NULL,

  -- Tipo de integração
  type text NOT NULL CHECK (type IN ('google_calendar', 'whatsapp', 'instagram', 'email', 'revolut')),

  -- Credenciais OAuth (criptografadas)
  access_token text,
  refresh_token text,
  token_expires_at timestamp,

  -- Status
  is_active boolean DEFAULT true,

  -- Última sincronização
  last_sync_at timestamp,
  last_error text,

  -- Configurações específicas (JSON flexível)
  settings jsonb DEFAULT '{}',

  -- Campos específicos do Google Calendar
  google_calendar_id text,

  -- Campos específicos do Instagram
  instagram_user_id text,
  instagram_username text,

  -- Campos específicos do Revolut
  revolut_merchant_id text,

  -- Campos específicos do Email
  email_from_name text,
  email_from_email text,

  -- Metadata adicional
  metadata jsonb DEFAULT '{}',

  -- Timestamps
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),

  -- Uma integração de cada tipo por profissional
  UNIQUE(professional_id, type)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_integrations_professional ON integrations(professional_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(type);
CREATE INDEX IF NOT EXISTS idx_integrations_active ON integrations(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profissional pode ver suas integrações" ON integrations;
CREATE POLICY "Profissional pode ver suas integrações"
  ON integrations FOR SELECT
  USING (professional_id = auth.uid());

DROP POLICY IF EXISTS "Profissional pode criar integrações" ON integrations;
CREATE POLICY "Profissional pode criar integrações"
  ON integrations FOR INSERT
  WITH CHECK (professional_id = auth.uid());

DROP POLICY IF EXISTS "Profissional pode atualizar suas integrações" ON integrations;
CREATE POLICY "Profissional pode atualizar suas integrações"
  ON integrations FOR UPDATE
  USING (professional_id = auth.uid());

DROP POLICY IF EXISTS "Profissional pode deletar suas integrações" ON integrations;
CREATE POLICY "Profissional pode deletar suas integrações"
  ON integrations FOR DELETE
  USING (professional_id = auth.uid());

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS integrations_updated_at ON integrations;
CREATE TRIGGER integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_integrations_updated_at();

-- FIM
