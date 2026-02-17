-- =====================================================
-- CLEANUP: Remover objetos parciais antes de recriar
-- Execute ESTE arquivo primeiro se houver erros
-- =====================================================

-- Drop triggers
DROP TRIGGER IF EXISTS instagram_auto_post_vacancy ON bookings;
DROP TRIGGER IF EXISTS email_campaigns_updated_at ON email_campaigns;
DROP TRIGGER IF EXISTS revolut_payments_updated_at ON revolut_payments;

-- Drop functions
DROP FUNCTION IF EXISTS auto_post_instagram_on_vacancy() CASCADE;
DROP FUNCTION IF EXISTS update_email_campaign_updated_at() CASCADE;
DROP FUNCTION IF EXISTS get_contacts_by_segment(uuid, text, jsonb) CASCADE;

-- Drop views
DROP VIEW IF EXISTS email_campaign_performance CASCADE;
DROP VIEW IF EXISTS instagram_performance CASCADE;

-- Drop tables (CASCADE remove dependências)
DROP TABLE IF EXISTS email_campaign_recipients CASCADE;
DROP TABLE IF EXISTS email_campaigns CASCADE;
DROP TABLE IF EXISTS instagram_posts CASCADE;
DROP TABLE IF EXISTS revolut_payments CASCADE;

-- Remover colunas adicionadas em professionals (se quiser limpar)
-- ALTER TABLE professionals DROP COLUMN IF EXISTS address;
-- ALTER TABLE professionals DROP COLUMN IF EXISTS city;
-- ALTER TABLE professionals DROP COLUMN IF EXISTS postal_code;
-- ALTER TABLE professionals DROP COLUMN IF EXISTS country;
-- ALTER TABLE professionals DROP COLUMN IF EXISTS latitude;
-- ALTER TABLE professionals DROP COLUMN IF EXISTS longitude;
-- ALTER TABLE professionals DROP COLUMN IF EXISTS google_place_id;
-- ALTER TABLE professionals DROP COLUMN IF EXISTS instagram_handle;
-- ALTER TABLE professionals DROP COLUMN IF EXISTS instagram_user_id;
-- ALTER TABLE professionals DROP COLUMN IF EXISTS instagram_bio;
-- ALTER TABLE professionals DROP COLUMN IF EXISTS payment_provider;
-- ALTER TABLE professionals DROP COLUMN IF EXISTS revolut_merchant_id;

-- Drop índices
DROP INDEX IF EXISTS idx_professionals_location;
DROP INDEX IF EXISTS idx_professionals_instagram;
DROP INDEX IF EXISTS idx_email_campaigns_professional;
DROP INDEX IF EXISTS idx_email_campaigns_status;
DROP INDEX IF EXISTS idx_email_campaigns_scheduled;
DROP INDEX IF EXISTS idx_email_recipients_campaign;
DROP INDEX IF EXISTS idx_email_recipients_message_id;
DROP INDEX IF EXISTS idx_instagram_posts_professional;
DROP INDEX IF EXISTS idx_instagram_posts_type;
DROP INDEX IF EXISTS idx_instagram_posts_status;
DROP INDEX IF EXISTS idx_instagram_posts_trigger;
DROP INDEX IF EXISTS idx_revolut_payments_professional;
DROP INDEX IF EXISTS idx_revolut_payments_order;
DROP INDEX IF EXISTS idx_revolut_payments_status;

-- Remover constraint de integrations type (se existir)
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_type_check;
