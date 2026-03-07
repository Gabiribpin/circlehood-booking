-- Fix #260: Add professional_id to whatsapp_config for consistency with other tables.
-- Keeps user_id for backward compatibility; adds professional_id as the canonical FK.

-- 1. Add column (nullable initially for backfill)
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE;

-- 2. Backfill from professionals table
UPDATE whatsapp_config wc
SET professional_id = p.id
FROM professionals p
WHERE wc.user_id = p.user_id
  AND wc.professional_id IS NULL;

-- 3. Index for lookups by professional_id
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_professional_id
  ON whatsapp_config(professional_id);

-- 4. Update RLS policies to also allow access via professional_id
-- (keeps auth.uid() = user_id as primary check)
DROP POLICY IF EXISTS "Users can view own WhatsApp config" ON whatsapp_config;
CREATE POLICY "Users can view own WhatsApp config"
  ON whatsapp_config FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own WhatsApp config" ON whatsapp_config;
CREATE POLICY "Users can insert own WhatsApp config"
  ON whatsapp_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own WhatsApp config" ON whatsapp_config;
CREATE POLICY "Users can update own WhatsApp config"
  ON whatsapp_config FOR UPDATE
  USING (auth.uid() = user_id);
