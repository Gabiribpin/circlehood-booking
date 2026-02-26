-- Migration: 20260226000009_payment_failed_tracking
-- Tracks when a professional's subscription payment fails.
-- Used to give a 5-business-day grace period before disabling the public page.

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMPTZ;

COMMENT ON COLUMN professionals.payment_failed_at IS
  'Set when a Stripe invoice payment fails (invoice.payment_failed webhook). Cleared when payment succeeds. Used to compute the 5-business-day grace period before deactivating the public page.';
