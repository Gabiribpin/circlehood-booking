-- Fix #314: Add composite index on waitlist(professional_id, service_id)
CREATE INDEX IF NOT EXISTS idx_waitlist_professional_service ON waitlist(professional_id, service_id);
