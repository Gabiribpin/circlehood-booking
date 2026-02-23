-- Add locale preference to professionals
ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'pt-BR';

ALTER TABLE professionals
ADD CONSTRAINT IF NOT EXISTS check_professional_locale
CHECK (locale IN ('pt-BR', 'en-US', 'es-ES'));

COMMENT ON COLUMN professionals.locale IS
'Idioma preferido do profissional para o dashboard (pt-BR, en-US, es-ES)';

-- Add detected client locale to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS client_locale VARCHAR(10) DEFAULT 'pt-BR';

ALTER TABLE bookings
ADD CONSTRAINT IF NOT EXISTS check_booking_client_locale
CHECK (client_locale IN ('pt-BR', 'en-US', 'es-ES'));

COMMENT ON COLUMN bookings.client_locale IS
'Idioma detectado do cliente no momento do agendamento';
