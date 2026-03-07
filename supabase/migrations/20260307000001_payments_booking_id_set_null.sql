-- Fix #200: Change payments.booking_id from ON DELETE CASCADE to ON DELETE SET NULL
-- Preserves payment records for audit/accounting when a booking is deleted.

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_booking_id_fkey;

ALTER TABLE payments
  ADD CONSTRAINT payments_booking_id_fkey
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
