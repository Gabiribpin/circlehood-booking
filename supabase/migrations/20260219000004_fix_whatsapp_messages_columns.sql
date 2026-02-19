-- Fix: a tabela whatsapp_messages foi criada pela migration 20250218000000
-- com schema diferente (message_content, professional_id, recipient_phone).
-- A migration 20260218000002 falhou ao tentar recriar a tabela.
-- Esta migration adiciona as colunas que o bot precisa para funcionar.

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS direction VARCHAR(10),
  ADD COLUMN IF NOT EXISTS content TEXT;

-- Índice para queries de histórico por conversa
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation
  ON whatsapp_messages (conversation_id, sent_at DESC);

-- Copiar message_content → content para mensagens existentes (retrocompatibilidade)
UPDATE whatsapp_messages
SET content = message_content
WHERE content IS NULL AND message_content IS NOT NULL;
