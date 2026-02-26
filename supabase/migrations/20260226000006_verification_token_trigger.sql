-- ─── Verification Token Cleanup Function ─────────────────────────────────────
-- Utility function to clean up expired tokens.
-- Can be called manually or via a cron job.

CREATE OR REPLACE FUNCTION cleanup_expired_verification_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM email_verification_tokens
  WHERE expires_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_verification_tokens() IS
  'Deletes expired (>7 days old) email verification tokens. Call periodically via cron.';
