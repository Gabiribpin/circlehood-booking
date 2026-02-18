-- Adicionar suporte à Evolution API na tabela whatsapp_config
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'meta',
  ADD COLUMN IF NOT EXISTS evolution_api_url TEXT,
  ADD COLUMN IF NOT EXISTS evolution_api_key TEXT,
  ADD COLUMN IF NOT EXISTS evolution_instance TEXT;
