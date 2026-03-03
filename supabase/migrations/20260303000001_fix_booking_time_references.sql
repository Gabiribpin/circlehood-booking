-- =====================================================
-- FIX: Corrigir funções que referenciam booking_time (coluna inexistente)
-- Data: 2026-03-03
-- Issue: #27
-- Problema: Triggers/funções usam booking_time mas coluna real é start_time
--   Também: contact_name → client_name em check_calendar_conflicts
-- Funções afetadas:
--   1. notify_waitlist_on_cancellation() — trigger AFTER UPDATE on bookings
--   2. get_available_slots() — função auxiliar
--   3. check_calendar_conflicts() — função auxiliar
-- =====================================================

-- Fix 1: notify_waitlist_on_cancellation
-- Trigger que notifica waitlist quando booking é cancelado
CREATE OR REPLACE FUNCTION notify_waitlist_on_cancellation()
RETURNS TRIGGER AS $$
DECLARE
  v_waitlist_record RECORD;
  v_professional RECORD;
BEGIN
  -- Só processa se mudou de confirmado para cancelado
  IF OLD.status = 'confirmed' AND NEW.status = 'cancelled' THEN

    -- Busca profissional
    SELECT * INTO v_professional FROM professionals WHERE id = NEW.professional_id;

    -- Busca primeiro da waitlist para este serviço e data
    SELECT * INTO v_waitlist_record
    FROM waitlist
    WHERE professional_id = NEW.professional_id
      AND service_id = NEW.service_id
      AND NEW.booking_date = ANY(preferred_dates)
      AND status = 'active'
      AND notified = false
    ORDER BY created_at ASC
    LIMIT 1;

    -- Se encontrou alguém na waitlist, adiciona na fila de notificações
    IF v_waitlist_record.id IS NOT NULL THEN
      INSERT INTO notification_queue (
        professional_id,
        type,
        recipient_name,
        recipient_phone,
        recipient_email,
        message_template,
        message_data,
        language
      ) VALUES (
        NEW.professional_id,
        'waitlist_available',
        v_waitlist_record.contact_name,
        v_waitlist_record.contact_phone,
        v_waitlist_record.contact_email,
        'waitlist_available',
        jsonb_build_object(
          'waitlist_id', v_waitlist_record.id,
          'booking_date', NEW.booking_date,
          'booking_time', NEW.start_time,
          'service_id', NEW.service_id,
          'professional_name', v_professional.business_name,
          'professional_slug', v_professional.slug
        ),
        'pt'
      );

      -- Marca waitlist como notificado
      UPDATE waitlist
      SET
        notified = true,
        notified_at = now(),
        notification_expires_at = now() + interval '24 hours',
        status = 'notified'
      WHERE id = v_waitlist_record.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix 2: get_available_slots
-- Função auxiliar para buscar horários disponíveis
CREATE OR REPLACE FUNCTION get_available_slots(
  p_professional_id uuid,
  p_date date,
  p_duration_minutes integer
)
RETURNS TABLE (
  time_slot time,
  is_available boolean
) AS $$
BEGIN
  RETURN QUERY
  WITH all_slots AS (
    SELECT generate_series(
      '09:00'::time,
      '18:00'::time,
      '30 minutes'::interval
    )::time AS slot
  ),
  booked_slots AS (
    SELECT
      b.start_time::time AS booking_start,
      CASE
        WHEN b.package_id IS NOT NULL THEN
          (SELECT duration_minutes FROM service_packages WHERE id = b.package_id)
        ELSE
          (SELECT duration_minutes FROM services WHERE id = b.service_id)
      END as duration
    FROM bookings b
    WHERE b.professional_id = p_professional_id
      AND b.booking_date = p_date
      AND b.status IN ('pending', 'confirmed')
  )
  SELECT
    s.slot,
    NOT EXISTS (
      SELECT 1 FROM booked_slots bs
      WHERE s.slot >= bs.booking_start
        AND s.slot < bs.booking_start + (bs.duration || ' minutes')::interval
    ) as is_available
  FROM all_slots s
  ORDER BY s.slot;
END;
$$ LANGUAGE plpgsql;

-- Fix 3: check_calendar_conflicts
-- Função auxiliar para detectar conflitos de horário
CREATE OR REPLACE FUNCTION check_calendar_conflicts(
  p_professional_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS TABLE(
  conflict_type text,
  conflict_source text,
  event_title text,
  event_start timestamptz,
  event_end timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    'booking_conflict'::text,
    'circlehood'::text,
    b.client_name,
    (b.booking_date::date + b.start_time::time)::timestamptz,
    (b.booking_date::date + b.end_time::time)::timestamptz
  FROM bookings b
  WHERE b.professional_id = p_professional_id
    AND b.status IN ('confirmed', 'pending')
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
    AND (
      (b.booking_date::date + b.start_time::time)::timestamptz < p_end_time
      AND (b.booking_date::date + b.end_time::time)::timestamptz > p_start_time
    )

  UNION ALL

  SELECT
    'calendar_conflict'::text,
    ce.source::text,
    ce.title,
    ce.start_time,
    ce.end_time
  FROM calendar_events ce
  WHERE ce.professional_id = p_professional_id
    AND ce.status = 'confirmed'
    AND ce.booking_id IS NULL -- Eventos externos
    AND ce.start_time < p_end_time
    AND ce.end_time > p_start_time;
END;
$$ LANGUAGE plpgsql;
