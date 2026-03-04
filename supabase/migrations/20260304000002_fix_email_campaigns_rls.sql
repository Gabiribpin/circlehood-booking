-- Fix #102: email_campaigns RLS policies usam auth.uid() diretamente,
-- mas professional_id referencia professionals.id (não auth.users.id).
-- Corrige para usar subquery que resolve o user_id → professional_id.

-- email_campaigns: SELECT
DROP POLICY IF EXISTS "Profissional pode ver suas campanhas" ON email_campaigns;
CREATE POLICY "Profissional pode ver suas campanhas"
  ON email_campaigns FOR SELECT
  USING (professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()));

-- email_campaigns: INSERT
DROP POLICY IF EXISTS "Profissional pode criar campanhas" ON email_campaigns;
CREATE POLICY "Profissional pode criar campanhas"
  ON email_campaigns FOR INSERT
  WITH CHECK (professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()));

-- email_campaigns: UPDATE
DROP POLICY IF EXISTS "Profissional pode atualizar suas campanhas" ON email_campaigns;
CREATE POLICY "Profissional pode atualizar suas campanhas"
  ON email_campaigns FOR UPDATE
  USING (professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()));

-- email_campaigns: DELETE
DROP POLICY IF EXISTS "Profissional pode deletar suas campanhas" ON email_campaigns;
CREATE POLICY "Profissional pode deletar suas campanhas"
  ON email_campaigns FOR DELETE
  USING (professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()));

-- email_campaign_recipients: SELECT (via campaign ownership)
DROP POLICY IF EXISTS "Profissional pode ver destinatários" ON email_campaign_recipients;
CREATE POLICY "Profissional pode ver destinatários"
  ON email_campaign_recipients FOR SELECT
  USING (campaign_id IN (
    SELECT id FROM email_campaigns
    WHERE professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid())
  ));
