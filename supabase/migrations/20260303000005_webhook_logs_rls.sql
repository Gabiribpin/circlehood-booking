-- Fix: webhook_logs sem RLS — qualquer user autenticado podia ler todos os logs.
-- metadata JSONB pode conter phone numbers e instance_name expõe Evolution API de outros profissionais.
--
-- Solução: habilitar RLS e NÃO criar policies para anon/authenticated.
-- Apenas service_role (que bypassa RLS) pode acessar — usado pelo admin health dashboard.

-- Criar tabela se não existir (pode ter sido criada fora de migrations)
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  instance_name TEXT NOT NULL,
  status INT NOT NULL,
  error TEXT,
  processing_time_ms INT,
  rate_limited BOOLEAN DEFAULT false,
  metadata JSONB
);

-- Habilitar RLS — sem policies = 0 rows para anon/authenticated
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE webhook_logs IS
  'Webhook processing logs. RLS enabled, no user policies — only service_role can access.';
