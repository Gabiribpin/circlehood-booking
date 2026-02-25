-- Add locale preference to professionals
ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'pt-BR';

-- ADD CONSTRAINT IF NOT EXISTS não existe no PostgreSQL; usar DO/EXCEPTION
DO $$ BEGIN
  ALTER TABLE professionals
    ADD CONSTRAINT check_professional_locale
    CHECK (locale IN ('pt-BR', 'en-US', 'es-ES'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN professionals.locale IS
'Idioma preferido do profissional para o dashboard (pt-BR, en-US, es-ES)';

-- Add detected client locale to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS client_locale VARCHAR(10) DEFAULT 'pt-BR';

DO $$ BEGIN
  ALTER TABLE bookings
    ADD CONSTRAINT check_booking_client_locale
    CHECK (client_locale IN ('pt-BR', 'en-US', 'es-ES'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN bookings.client_locale IS
'Idioma detectado do cliente no momento do agendamento';
