-- Add professional_id to whatsapp_conversations, ai_instructions, whatsapp_templates
-- for consistent multi-tenant isolation (#109)

-- 1. whatsapp_conversations
ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE;

-- Back-fill from professionals.user_id
UPDATE whatsapp_conversations wc
SET professional_id = p.id
FROM professionals p
WHERE wc.user_id = p.user_id
  AND wc.professional_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_professional
  ON whatsapp_conversations(professional_id);

-- 2. ai_instructions
ALTER TABLE ai_instructions
  ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE;

UPDATE ai_instructions ai
SET professional_id = p.id
FROM professionals p
WHERE ai.user_id = p.user_id
  AND ai.professional_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_instructions_professional
  ON ai_instructions(professional_id);

-- 3. whatsapp_templates
ALTER TABLE whatsapp_templates
  ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE;

UPDATE whatsapp_templates wt
SET professional_id = p.id
FROM professionals p
WHERE wt.user_id = p.user_id
  AND wt.professional_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_professional
  ON whatsapp_templates(professional_id);

-- 4. Update RLS policies to use professional_id subquery pattern
-- (consistent with bookings, services, etc.)

-- whatsapp_conversations
DROP POLICY IF EXISTS "Users can view own conversations" ON whatsapp_conversations;
DROP POLICY IF EXISTS "Users can manage own conversations" ON whatsapp_conversations;

CREATE POLICY "Users can view own conversations"
  ON whatsapp_conversations FOR SELECT
  USING (
    professional_id IN (
      SELECT id FROM professionals WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can manage own conversations"
  ON whatsapp_conversations FOR ALL
  USING (
    professional_id IN (
      SELECT id FROM professionals WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- ai_instructions
DROP POLICY IF EXISTS "Users can manage own AI instructions" ON ai_instructions;

CREATE POLICY "Users can manage own AI instructions"
  ON ai_instructions FOR ALL
  USING (
    professional_id IN (
      SELECT id FROM professionals WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- whatsapp_templates
DROP POLICY IF EXISTS "Users can manage own templates" ON whatsapp_templates;

CREATE POLICY "Users can manage own templates"
  ON whatsapp_templates FOR ALL
  USING (
    professional_id IN (
      SELECT id FROM professionals WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );
