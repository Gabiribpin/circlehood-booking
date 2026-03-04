-- Fix #105: cron_logs had USING(true) policy allowing any authenticated user
-- to read/write all cron logs. Drop the permissive policy — with RLS enabled
-- and no policies, only service_role (which bypasses RLS) can access the table.

DROP POLICY IF EXISTS "Sistema pode gerenciar cron logs" ON cron_logs;
