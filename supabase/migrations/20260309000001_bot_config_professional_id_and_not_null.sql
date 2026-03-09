-- Fix #457: Add professional_id to bot_config + SET NOT NULL on all WhatsApp tables
-- + Remove user_id fallback from RLS policies

-- ============================================================
-- 1. bot_config: add professional_id, backfill, index, RLS
-- ============================================================
ALTER TABLE bot_config
  ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE;

UPDATE bot_config bc
SET professional_id = p.id
FROM professionals p
WHERE bc.user_id = p.user_id
  AND bc.professional_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_bot_config_professional_id
  ON bot_config(professional_id);

-- Delete orphan rows (no matching professional) before NOT NULL
DELETE FROM bot_config WHERE professional_id IS NULL;

ALTER TABLE bot_config ALTER COLUMN professional_id SET NOT NULL;

-- Add unique constraint on professional_id (one config per professional)
ALTER TABLE bot_config
  ADD CONSTRAINT bot_config_professional_id_unique UNIQUE (professional_id);

-- Update RLS to use professional_id
DROP POLICY IF EXISTS "Users manage own bot_config" ON bot_config;

CREATE POLICY "Users manage own bot_config"
  ON bot_config FOR ALL
  USING (
    professional_id IN (
      SELECT id FROM professionals WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    professional_id IN (
      SELECT id FROM professionals WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 2. SET NOT NULL on professional_id for 4 WhatsApp tables
--    (column already exists, already backfilled)
-- ============================================================

-- Delete orphan rows first
DELETE FROM whatsapp_config WHERE professional_id IS NULL AND user_id NOT IN (SELECT user_id FROM professionals);
DELETE FROM whatsapp_conversations WHERE professional_id IS NULL AND user_id NOT IN (SELECT user_id FROM professionals);
DELETE FROM ai_instructions WHERE professional_id IS NULL AND user_id NOT IN (SELECT user_id FROM professionals);
DELETE FROM whatsapp_templates WHERE professional_id IS NULL AND user_id NOT IN (SELECT user_id FROM professionals);

-- Re-backfill any stragglers
UPDATE whatsapp_config wc SET professional_id = p.id FROM professionals p WHERE wc.user_id = p.user_id AND wc.professional_id IS NULL;
UPDATE whatsapp_conversations wc SET professional_id = p.id FROM professionals p WHERE wc.user_id = p.user_id AND wc.professional_id IS NULL;
UPDATE ai_instructions ai SET professional_id = p.id FROM professionals p WHERE ai.user_id = p.user_id AND ai.professional_id IS NULL;
UPDATE whatsapp_templates wt SET professional_id = p.id FROM professionals p WHERE wt.user_id = p.user_id AND wt.professional_id IS NULL;

-- Delete any remaining orphans
DELETE FROM whatsapp_config WHERE professional_id IS NULL;
DELETE FROM whatsapp_conversations WHERE professional_id IS NULL;
DELETE FROM ai_instructions WHERE professional_id IS NULL;
DELETE FROM whatsapp_templates WHERE professional_id IS NULL;

ALTER TABLE whatsapp_config ALTER COLUMN professional_id SET NOT NULL;
ALTER TABLE whatsapp_conversations ALTER COLUMN professional_id SET NOT NULL;
ALTER TABLE ai_instructions ALTER COLUMN professional_id SET NOT NULL;
ALTER TABLE whatsapp_templates ALTER COLUMN professional_id SET NOT NULL;

-- ============================================================
-- 3. Remove user_id fallback from RLS policies
-- ============================================================

-- whatsapp_conversations
DROP POLICY IF EXISTS "Users can view own conversations" ON whatsapp_conversations;
DROP POLICY IF EXISTS "Users can manage own conversations" ON whatsapp_conversations;

CREATE POLICY "Users can view own conversations"
  ON whatsapp_conversations FOR SELECT
  USING (
    professional_id IN (
      SELECT id FROM professionals WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own conversations"
  ON whatsapp_conversations FOR ALL
  USING (
    professional_id IN (
      SELECT id FROM professionals WHERE user_id = auth.uid()
    )
  );

-- ai_instructions
DROP POLICY IF EXISTS "Users can manage own AI instructions" ON ai_instructions;

CREATE POLICY "Users can manage own AI instructions"
  ON ai_instructions FOR ALL
  USING (
    professional_id IN (
      SELECT id FROM professionals WHERE user_id = auth.uid()
    )
  );

-- whatsapp_templates
DROP POLICY IF EXISTS "Users can manage own templates" ON whatsapp_templates;

CREATE POLICY "Users can manage own templates"
  ON whatsapp_templates FOR ALL
  USING (
    professional_id IN (
      SELECT id FROM professionals WHERE user_id = auth.uid()
    )
  );

-- notifications (also had fallback)
DROP POLICY IF EXISTS "Users can manage own notifications" ON notifications;

CREATE POLICY "Users can manage own notifications"
  ON notifications FOR ALL
  USING (
    professional_id IN (
      SELECT id FROM professionals WHERE user_id = auth.uid()
    )
  );
