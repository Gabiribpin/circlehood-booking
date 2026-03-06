-- =====================================================
-- FIX: integrations + instagram_posts RLS
-- professional_id = auth.uid() é sempre false porque
-- professional_id referencia professionals.id, não auth.users.id
-- Correção: usar subquery professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid())
-- =====================================================

-- 1. INTEGRATIONS — dropar policies antigas e recriar
DROP POLICY IF EXISTS "Profissional pode ver suas integrações" ON integrations;
DROP POLICY IF EXISTS "Profissional pode criar integrações" ON integrations;
DROP POLICY IF EXISTS "Profissional pode atualizar suas integrações" ON integrations;
DROP POLICY IF EXISTS "Profissional pode deletar suas integrações" ON integrations;

CREATE POLICY "Profissional pode ver suas integrações"
  ON integrations FOR SELECT
  USING (professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()));

CREATE POLICY "Profissional pode criar integrações"
  ON integrations FOR INSERT
  WITH CHECK (professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()));

CREATE POLICY "Profissional pode atualizar suas integrações"
  ON integrations FOR UPDATE
  USING (professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()));

CREATE POLICY "Profissional pode deletar suas integrações"
  ON integrations FOR DELETE
  USING (professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()));

-- 2. INSTAGRAM_POSTS — dropar policy antiga e recriar
DROP POLICY IF EXISTS "Profissional pode gerenciar seus posts no Instagram" ON instagram_posts;

CREATE POLICY "Profissional pode gerenciar seus posts no Instagram"
  ON instagram_posts FOR ALL
  USING (professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()));
