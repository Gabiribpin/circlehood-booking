-- Fix #304: Add missing index on bookings.professional_id (most used FK in RLS filters)
CREATE INDEX IF NOT EXISTS idx_bookings_professional_id ON bookings(professional_id);
