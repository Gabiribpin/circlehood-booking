-- ========================================
-- SPRINT 3: WhatsApp Inteligente - Imported Contacts
-- Criar tabela de contatos importados
-- ========================================

CREATE TABLE imported_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,

  -- Dados básicos
  name text NOT NULL,
  phone text NOT NULL,
  email text,

  -- Classificação
  nationality text,
  preferred_language text DEFAULT 'en',
  dublin_zone text,

  -- Endereço
  address text,
  postal_code text,

  -- Tags
  tags text[] DEFAULT '{}',

  -- Notas
  notes text,

  -- Histórico
  first_service_date timestamp,
  last_service_date timestamp,
  total_bookings integer DEFAULT 0,
  total_spent numeric(10,2) DEFAULT 0.00,

  -- Preferências
  preferred_service_id uuid REFERENCES services(id),
  preferred_day_of_week integer,

  -- Consentimento
  marketing_consent boolean DEFAULT false,
  whatsapp_consent boolean DEFAULT true,

  -- Metadata
  source text DEFAULT 'manual',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),

  UNIQUE(professional_id, phone)
);

-- Índices
CREATE INDEX idx_imported_contacts_professional ON imported_contacts(professional_id);
CREATE INDEX idx_imported_contacts_nationality ON imported_contacts(nationality);
CREATE INDEX idx_imported_contacts_language ON imported_contacts(preferred_language);
CREATE INDEX idx_imported_contacts_zone ON imported_contacts(dublin_zone);
CREATE INDEX idx_imported_contacts_tags ON imported_contacts USING gin(tags);

-- RLS
ALTER TABLE imported_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional pode ver seus próprios contatos"
  ON imported_contacts FOR SELECT
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

CREATE POLICY "Profissional pode inserir contatos"
  ON imported_contacts FOR INSERT
  WITH CHECK (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

CREATE POLICY "Profissional pode atualizar seus contatos"
  ON imported_contacts FOR UPDATE
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

CREATE POLICY "Profissional pode deletar seus contatos"
  ON imported_contacts FOR DELETE
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

-- Atualizar tabela bookings para referenciar imported_contacts
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES imported_contacts(id);

CREATE INDEX IF NOT EXISTS idx_bookings_contact ON bookings(contact_id);
