-- =====================================================
-- FIX: Adicionar UNIQUE constraint em calendar_events.booking_id
-- O trigger sync_booking_to_calendar usa ON CONFLICT (booking_id)
-- mas booking_id não tinha unique constraint — apenas google_event_id tinha.
-- Isso causava erro de runtime ou duplicatas.
-- =====================================================

-- Remover duplicatas antes de adicionar constraint (manter o mais recente)
DELETE FROM calendar_events a
USING calendar_events b
WHERE a.booking_id = b.booking_id
  AND a.booking_id IS NOT NULL
  AND a.created_at < b.created_at;

-- Adicionar unique constraint
ALTER TABLE calendar_events
  ADD CONSTRAINT calendar_events_booking_id_unique UNIQUE (booking_id);
