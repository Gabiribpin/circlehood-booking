-- Adicionar coluna created_via na tabela bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS created_via VARCHAR(50) DEFAULT 'manual';

COMMENT ON COLUMN bookings.created_via IS
'Origem do agendamento: manual, whatsapp_bot, landing_page, etc.';
