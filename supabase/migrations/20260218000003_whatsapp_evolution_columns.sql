-- Adicionar suporte Evolution API à tabela whatsapp_config
-- Migration: Sprint 8 Fase 2 — Evolution API provider

-- 1. Adicionar coluna provider (meta ou evolution)
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'meta';

-- 2. Adicionar colunas específicas da Evolution API
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS evolution_api_url TEXT,
  ADD COLUMN IF NOT EXISTS evolution_api_key TEXT,
  ADD COLUMN IF NOT EXISTS evolution_instance TEXT;

-- 3. Tornar colunas Meta opcionais (para utilizadores Evolution não precisarem preenchê-las)
ALTER TABLE whatsapp_config
  ALTER COLUMN phone_number_id DROP NOT NULL,
  ALTER COLUMN access_token DROP NOT NULL,
  ALTER COLUMN verify_token DROP NOT NULL;

-- 4. Índice para lookup por instância Evolution (usado no processor.ts)
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_evolution_instance
  ON whatsapp_config (evolution_instance)
  WHERE evolution_instance IS NOT NULL;
