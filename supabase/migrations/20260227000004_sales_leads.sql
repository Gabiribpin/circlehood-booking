-- Sales Leads: gestão de leads de vendas via WhatsApp
-- Tabelas: sales_leads, sales_conversations, sales_messages

-- ─── sales_leads ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sales_leads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone          TEXT NOT NULL,
  name           TEXT,
  email          TEXT,
  source         TEXT NOT NULL DEFAULT 'whatsapp',   -- whatsapp | manual | website
  status         TEXT NOT NULL DEFAULT 'new',         -- new | contacted | qualified | converted | lost
  notes          TEXT,
  assigned_to    TEXT,                                -- nome do vendedor (admin)
  converted_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(phone)
);

CREATE INDEX idx_sales_leads_status  ON sales_leads(status);
CREATE INDEX idx_sales_leads_phone   ON sales_leads(phone);
CREATE INDEX idx_sales_leads_created ON sales_leads(created_at DESC);

-- Não tem RLS: tabela de uso exclusivo do admin (sem auth.uid() vinculado)
-- O painel admin usa service_role key → acesso irrestrito

-- ─── sales_conversations ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sales_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    UUID NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  channel    TEXT NOT NULL DEFAULT 'whatsapp',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  bot_active BOOLEAN NOT NULL DEFAULT TRUE,   -- false = admin assumiu
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lead_id, channel)
);

CREATE INDEX idx_sales_conv_lead ON sales_conversations(lead_id);

-- ─── sales_messages ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sales_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES sales_conversations(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL,    -- inbound | outbound
  author          TEXT NOT NULL,    -- lead | bot | admin
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sales_msg_conv    ON sales_messages(conversation_id);
CREATE INDEX idx_sales_msg_created ON sales_messages(created_at DESC);
