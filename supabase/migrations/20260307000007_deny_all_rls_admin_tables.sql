-- C-02: Add deny-all RLS to admin-only tables
-- Service role bypasses RLS automatically, so these tables remain
-- accessible to admin code while blocking anon/authenticated clients.

-- sales_leads
ALTER TABLE sales_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all" ON sales_leads USING (false);

-- sales_conversations
ALTER TABLE sales_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all" ON sales_conversations USING (false);

-- sales_messages
ALTER TABLE sales_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all" ON sales_messages USING (false);

-- control_center_entries
ALTER TABLE control_center_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all" ON control_center_entries USING (false);
