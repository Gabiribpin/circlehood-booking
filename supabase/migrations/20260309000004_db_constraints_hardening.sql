-- Fix #461 M7: professionals.user_id SET NOT NULL
-- Fix #461 M8: Add missing index on bookings.client_phone

-- M7: user_id should never be NULL (every professional has an auth user)
-- Delete orphans first (shouldn't exist, but be safe)
DELETE FROM professionals WHERE user_id IS NULL;
ALTER TABLE professionals ALTER COLUMN user_id SET NOT NULL;

-- M8: Index for idempotency check and client lookups by phone
CREATE INDEX IF NOT EXISTS idx_bookings_client_phone ON bookings(client_phone);
