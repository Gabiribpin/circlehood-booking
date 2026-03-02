-- Add bot_enabled column to whatsapp_config
-- This is a global on/off toggle for the AI bot, separate from is_active (connection state).
-- When bot_enabled = false, the bot won't respond to messages even if WhatsApp is connected.
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS bot_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN whatsapp_config.bot_enabled IS 'Global toggle to enable/disable the AI bot. Independent of connection status (is_active).';
