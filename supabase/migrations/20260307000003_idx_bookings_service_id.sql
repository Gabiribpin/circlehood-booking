-- Fix #202: Add missing index on bookings.service_id (most used FK in JOINs)
CREATE INDEX IF NOT EXISTS idx_bookings_service_id ON bookings(service_id);
