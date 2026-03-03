-- Fix: reschedule_tokens had USING(true) policies allowing any anon user
-- to list all tokens. Drop public policies since all access is now via
-- service role (createAdminClient) in API routes.

DROP POLICY IF EXISTS "Acesso público via token" ON reschedule_tokens;
DROP POLICY IF EXISTS "Sistema pode criar tokens" ON reschedule_tokens;
DROP POLICY IF EXISTS "Sistema pode atualizar tokens" ON reschedule_tokens;

-- Service role bypasses RLS, so no replacement policies needed.
-- RLS remains enabled to block anon/authenticated key access.
