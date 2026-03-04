-- Enforce NOT NULL on bookings.service_id (#111)
-- A booking without a service breaks analytics and billing.

-- Safety: remove any orphaned rows with NULL service_id
DELETE FROM bookings WHERE service_id IS NULL;

-- Add NOT NULL constraint
ALTER TABLE bookings ALTER COLUMN service_id SET NOT NULL;
