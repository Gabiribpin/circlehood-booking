-- ─── Mark All Existing Professionals as Verified ─────────────────────────────
-- Safety backfill: all professionals created before this system was introduced
-- are considered verified (they were created without the email verification flow).
-- Migration 20260226000004 already did this, but we repeat for safety.

UPDATE professionals
SET email_verified = TRUE
WHERE email_verified = FALSE;
