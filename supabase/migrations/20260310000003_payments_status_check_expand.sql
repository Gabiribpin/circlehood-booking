-- Expand payments status CHECK constraint to include all statuses used by webhooks
-- Missing: partially_refunded (charge.refunded partial), disputed (charge.dispute.created), cancelled (payment_intent.canceled)

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'disputed', 'cancelled'));
