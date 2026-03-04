-- Add professional_id to notifications table for multi-tenant isolation (#110)

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE;

-- Back-fill from professionals.user_id
UPDATE notifications n
SET professional_id = p.id
FROM professionals p
WHERE n.user_id = p.user_id
  AND n.professional_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_professional
  ON notifications(professional_id);

-- Update RLS policy to use professional_id subquery pattern
DROP POLICY IF EXISTS "Users can manage own notifications" ON notifications;

CREATE POLICY "Users can manage own notifications"
  ON notifications FOR ALL
  USING (
    professional_id IN (
      SELECT id FROM professionals WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );
