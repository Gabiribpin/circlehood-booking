-- Fix: bookings.service_id was nullable, allowing bookings without a service.
-- This causes NULL in analytics/revenue queries and "undefined" in UI.

-- Safety: delete any orphaned bookings with NULL service_id
-- (these are invalid and should not exist)
DELETE FROM bookings WHERE service_id IS NULL;

-- Add NOT NULL constraint
ALTER TABLE bookings ALTER COLUMN service_id SET NOT NULL;
