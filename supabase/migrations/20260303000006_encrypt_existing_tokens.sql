-- Placeholder migration: existing plaintext tokens must be encrypted via a one-time script.
--
-- PostgreSQL does not have access to the OAUTH_TOKEN_ENCRYPTION_KEY env var,
-- so encryption must happen at the application level.
--
-- Run the following after deploying the new code:
--   POST /api/admin/encrypt-existing-tokens (with SETUP_SECRET)
--
-- This migration exists to document the requirement and maintain migration order.

-- No-op: encryption happens in the application layer.
SELECT 1;
