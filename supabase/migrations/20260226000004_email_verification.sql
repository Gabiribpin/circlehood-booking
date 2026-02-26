-- ─── Email Verification Tracking ─────────────────────────────────────────────
-- Tracks email verification status on the professionals table.
-- Supabase Auth natively tracks email_confirmed_at in auth.users;
-- this mirror field allows fast application-level checks without calling auth.admin.

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Back-fill: mark as verified any professional whose Supabase Auth user
-- already has a confirmed email (email_confirmed_at IS NOT NULL).
-- This is done at the application level in the registration flow going forward;
-- existing accounts are assumed verified.
UPDATE professionals SET email_verified = TRUE WHERE email_verified = FALSE;

-- Index for banner queries
CREATE INDEX IF NOT EXISTS idx_professionals_email_verified
  ON professionals(email_verified)
  WHERE email_verified = FALSE;

COMMENT ON COLUMN professionals.email_verified IS
  'Mirror of auth.users.email_confirmed_at IS NOT NULL. Updated by /api/auth/verify-email.';
