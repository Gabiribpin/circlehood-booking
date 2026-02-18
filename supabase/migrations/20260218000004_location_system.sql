-- Adicionar regiões ao cadastro de contatos
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS regions TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_contacts_regions ON contacts USING GIN(regions);

-- Tabela de broadcasts por região
CREATE TABLE region_broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  region VARCHAR(10) NOT NULL,
  message TEXT NOT NULL,
  available_time VARCHAR(5),
  recipients_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'sent', -- sent, failed
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_broadcasts_professional_region ON region_broadcasts(professional_id, region, created_at DESC);

-- RLS
ALTER TABLE region_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own broadcasts"
  ON region_broadcasts FOR ALL
  USING (
    professional_id IN (
      SELECT id FROM professionals WHERE user_id = auth.uid()
    )
  );
