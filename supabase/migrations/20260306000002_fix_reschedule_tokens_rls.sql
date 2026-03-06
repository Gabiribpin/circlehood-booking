-- Fix: reschedule_tokens RLS policies used USING(true) for SELECT and UPDATE,
-- exposing ALL tokens to any anon user and allowing unauthorized token usage.
--
-- All reschedule routes now use createAdminClient() (service role, bypasses RLS),
-- so we can safely remove the permissive public policies.
--
-- New policies:
--   SELECT/UPDATE: only the professional who owns the booking can access
--   INSERT: only service role (via admin client) — no public inserts

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Acesso público via token" ON reschedule_tokens;
DROP POLICY IF EXISTS "Sistema pode criar tokens" ON reschedule_tokens;
DROP POLICY IF EXISTS "Sistema pode atualizar tokens" ON reschedule_tokens;

-- Professional can view their own tokens (via booking ownership)
CREATE POLICY "Professional can view own tokens"
  ON reschedule_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = reschedule_tokens.booking_id
        AND b.professional_id IN (
          SELECT p.id FROM professionals p WHERE p.user_id = auth.uid()
        )
    )
  );

-- Professional can update their own tokens
CREATE POLICY "Professional can update own tokens"
  ON reschedule_tokens FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = reschedule_tokens.booking_id
        AND b.professional_id IN (
          SELECT p.id FROM professionals p WHERE p.user_id = auth.uid()
        )
    )
  );

-- No public INSERT — tokens are created by triggers or service role only
