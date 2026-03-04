-- Fix #104: revolut_payments RLS policy uses auth.uid() directly,
-- but professional_id references professionals.id (not auth.users.id).

DROP POLICY IF EXISTS "Profissional pode ver seus pagamentos Revolut" ON revolut_payments;
CREATE POLICY "Profissional pode ver seus pagamentos Revolut"
  ON revolut_payments FOR SELECT
  USING (professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()));
