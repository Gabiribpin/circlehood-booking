-- C-01: Enable RLS on 6 unprotected tables with tenant isolation
-- Service role (used by crons and admin code) bypasses RLS automatically.

-- ─── notification_queue ────────────────────────────────────────────────
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON notification_queue FOR ALL
  USING (professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()));

-- ─── notification_logs ─────────────────────────────────────────────────
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON notification_logs FOR ALL
  USING (professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()));

-- ─── waitlist ──────────────────────────────────────────────────────────
-- Public POST (anonymous insert) + authenticated professional reads
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_insert" ON waitlist FOR INSERT
  WITH CHECK (true);

CREATE POLICY "owner_can_read" ON waitlist FOR SELECT
  USING (professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()));

CREATE POLICY "owner_can_update" ON waitlist FOR UPDATE
  USING (professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()));

CREATE POLICY "owner_can_delete" ON waitlist FOR DELETE
  USING (professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()));

-- ─── service_packages ──────────────────────────────────────────────────
ALTER TABLE service_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON service_packages FOR ALL
  USING (professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()));

-- ─── loyalty_cards ─────────────────────────────────────────────────────
ALTER TABLE loyalty_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON loyalty_cards FOR ALL
  USING (professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()));

-- ─── loyalty_transactions (no direct professional_id — go through loyalty_cards) ──
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON loyalty_transactions FOR ALL
  USING (loyalty_card_id IN (
    SELECT id FROM loyalty_cards
    WHERE professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid())
  ));
