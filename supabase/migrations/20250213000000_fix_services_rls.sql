-- Allow professionals to see ALL their own services (including inactive)
CREATE POLICY "Owner can view all own services"
  ON services FOR SELECT
  USING (professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()));
