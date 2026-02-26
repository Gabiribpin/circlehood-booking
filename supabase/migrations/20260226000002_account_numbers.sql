-- ─── Account Numbers & Ticket Numbers ───────────────────────────────────────
-- Adds human-readable identifiers:
--   professionals.account_number  →  ACC-2026-00001
--   support_tickets.ticket_number →  TKT-2026-00001

-- ── Sequences ────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS account_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq  START 1;

-- ── Generator functions ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_account_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  year_part TEXT;
BEGIN
  next_num  := nextval('account_number_seq');
  year_part := EXTRACT(YEAR FROM NOW())::TEXT;
  RETURN 'ACC-' || year_part || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  year_part TEXT;
BEGIN
  next_num  := nextval('ticket_number_seq');
  year_part := EXTRACT(YEAR FROM NOW())::TEXT;
  RETURN 'TKT-' || year_part || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ── Column: professionals.account_number ─────────────────────────────────────
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS account_number TEXT UNIQUE;

-- Back-fill existing professionals (those without an account_number)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM professionals WHERE account_number IS NULL ORDER BY created_at
  LOOP
    UPDATE professionals
    SET account_number = generate_account_number()
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- Trigger: auto-assign on INSERT
CREATE OR REPLACE FUNCTION trg_set_account_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_number IS NULL THEN
    NEW.account_number := generate_account_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_account_number ON professionals;
CREATE TRIGGER set_account_number
  BEFORE INSERT ON professionals
  FOR EACH ROW EXECUTE FUNCTION trg_set_account_number();

-- ── Column: support_tickets.ticket_number ────────────────────────────────────
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS ticket_number TEXT UNIQUE;

-- Back-fill existing tickets
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM support_tickets WHERE ticket_number IS NULL ORDER BY created_at
  LOOP
    UPDATE support_tickets
    SET ticket_number = generate_ticket_number()
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- Trigger: auto-assign on INSERT
CREATE OR REPLACE FUNCTION trg_set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_ticket_number ON support_tickets;
CREATE TRIGGER set_ticket_number
  BEFORE INSERT ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION trg_set_ticket_number();

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_professionals_account_number ON professionals(account_number);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_number ON support_tickets(ticket_number);
