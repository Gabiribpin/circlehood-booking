-- Fix #305: Add missing index on services.professional_id (public booking page lookups)
CREATE INDEX IF NOT EXISTS idx_services_professional_id ON services(professional_id);
