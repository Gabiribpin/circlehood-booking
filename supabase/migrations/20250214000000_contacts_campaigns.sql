-- Tabela de Contatos
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(200),
  category VARCHAR(100),
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Campanhas
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- Tabela de Envios de Campanha
CREATE TABLE campaign_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  clicked BOOLEAN DEFAULT false,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_contacts_professional ON contacts(professional_id);
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_campaigns_professional ON campaigns(professional_id);
CREATE INDEX idx_campaign_sends_campaign ON campaign_sends(campaign_id);
CREATE INDEX idx_campaign_sends_contact ON campaign_sends(contact_id);

-- RLS para Contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own contacts"
  ON contacts FOR ALL
  USING (
    professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid())
  );

-- RLS para Campaigns
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own campaigns"
  ON campaigns FOR ALL
  USING (
    professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid())
  );

-- RLS para Campaign Sends
ALTER TABLE campaign_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner views own campaign sends"
  ON campaign_sends FOR SELECT
  USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE professional_id IN (
        SELECT id FROM professionals WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Owner manages own campaign sends"
  ON campaign_sends FOR INSERT
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM campaigns WHERE professional_id IN (
        SELECT id FROM professionals WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Owner updates own campaign sends"
  ON campaign_sends FOR UPDATE
  USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE professional_id IN (
        SELECT id FROM professionals WHERE user_id = auth.uid()
      )
    )
  );
