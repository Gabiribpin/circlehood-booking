-- ─── Support Ticket System ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  ai_escalated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author TEXT NOT NULL CHECK (author IN ('client', 'admin', 'bot')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- auto-update updated_at on support_tickets
CREATE OR REPLACE FUNCTION update_support_ticket_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_support_ticket_updated_at();

-- ─── Row Level Security ──────────────────────────────────────────────────────

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_replies  ENABLE ROW LEVEL SECURITY;

-- Professionals can CRUD their own tickets
CREATE POLICY "professionals_own_tickets" ON support_tickets
  FOR ALL USING (
    professional_id IN (
      SELECT id FROM professionals WHERE user_id = auth.uid()
    )
  );

-- Professionals can read replies on their tickets
CREATE POLICY "ticket_owners_view_replies" ON ticket_replies
  FOR SELECT USING (
    ticket_id IN (
      SELECT st.id FROM support_tickets st
      JOIN professionals p ON p.id = st.professional_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Professionals can insert replies on their own tickets
CREATE POLICY "ticket_owners_create_replies" ON ticket_replies
  FOR INSERT WITH CHECK (
    ticket_id IN (
      SELECT st.id FROM support_tickets st
      JOIN professionals p ON p.id = st.professional_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS support_tickets_professional_id_idx ON support_tickets(professional_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets(status);
CREATE INDEX IF NOT EXISTS ticket_replies_ticket_id_idx ON ticket_replies(ticket_id);
