-- Issue #141: Add missing indexes on user_id columns used by RLS subqueries
-- Without these, RLS policies cause full table scans on every authenticated request.

CREATE INDEX IF NOT EXISTS idx_whatsapp_config_user_id ON whatsapp_config(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_instructions_user_id ON ai_instructions(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_user_id ON whatsapp_templates(user_id);
-- notifications already has idx_notifications_user ON (user_id, status)
