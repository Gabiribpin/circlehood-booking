-- Endereço detalhado e visibilidade na landing page
ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS address_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS address_country VARCHAR(100) DEFAULT 'Ireland',
ADD COLUMN IF NOT EXISTS show_address_on_page BOOLEAN DEFAULT true;

COMMENT ON COLUMN professionals.address_city IS 'Cidade do estabelecimento';
COMMENT ON COLUMN professionals.show_address_on_page IS 'Mostrar endereço na landing page pública';

-- Tipo de atendimento por serviço
ALTER TABLE services
ADD COLUMN IF NOT EXISTS service_location VARCHAR(50) DEFAULT 'in_salon';

COMMENT ON COLUMN services.service_location IS
'Onde o serviço é prestado: in_salon, at_home, both';

-- Local do atendimento e endereço do cliente no agendamento
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS service_location VARCHAR(50) DEFAULT 'in_salon',
ADD COLUMN IF NOT EXISTS customer_address TEXT,
ADD COLUMN IF NOT EXISTS customer_address_city VARCHAR(100);

COMMENT ON COLUMN bookings.service_location IS 'Local deste agendamento: in_salon ou at_home';
COMMENT ON COLUMN bookings.customer_address IS 'Endereço do cliente quando at_home';
