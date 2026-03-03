-- Reschedule atômico: cancela booking antigo e cria novo numa única transação.
-- Se qualquer step falha, toda operação reverte automaticamente (rollback implícito).
-- Retorna JSON com resultado da operação.

CREATE OR REPLACE FUNCTION reschedule_booking(
  p_booking_id UUID,
  p_professional_id UUID,
  p_new_date DATE,
  p_new_start_time TIME,
  p_new_end_time TIME
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing RECORD;
  v_new_id UUID;
BEGIN
  -- 1. Buscar e validar booking existente (com lock para evitar race condition)
  SELECT id, booking_date, start_time, service_id, client_name, client_phone,
         client_email, notes, service_location, customer_address, status
    INTO v_existing
    FROM bookings
   WHERE id = p_booking_id
     AND professional_id = p_professional_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_existing.status != 'confirmed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_confirmed', 'current_status', v_existing.status);
  END IF;

  -- 2. Cancelar booking antigo
  UPDATE bookings
     SET status = 'cancelled',
         cancelled_by = 'client',
         cancelled_at = NOW(),
         cancellation_reason = 'Reagendado pelo cliente via WhatsApp'
   WHERE id = p_booking_id;

  -- 3. Inserir novo booking (pode lançar 23505 se slot já ocupado → transação reverte)
  INSERT INTO bookings (
    professional_id, service_id, booking_date, start_time, end_time,
    client_name, client_phone, client_email, notes,
    service_location, customer_address, status
  ) VALUES (
    p_professional_id, v_existing.service_id, p_new_date, p_new_start_time, p_new_end_time,
    v_existing.client_name, v_existing.client_phone, v_existing.client_email, v_existing.notes,
    COALESCE(v_existing.service_location, 'in_salon'), v_existing.customer_address, 'confirmed'
  )
  RETURNING id INTO v_new_id;

  -- 4. Sucesso — ambas operações commitadas juntas
  RETURN jsonb_build_object(
    'success', true,
    'new_booking_id', v_new_id,
    'old_date', v_existing.booking_date,
    'old_time', v_existing.start_time
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Slot já ocupado (23505) → transação INTEIRA reverte (old booking fica confirmed)
    RETURN jsonb_build_object('success', false, 'error', 'slot_taken');
  WHEN OTHERS THEN
    -- Qualquer outro erro → transação INTEIRA reverte
    RETURN jsonb_build_object('success', false, 'error', 'unexpected', 'detail', SQLERRM);
END;
$$;

COMMENT ON FUNCTION reschedule_booking IS
  'Transactional reschedule: cancels old booking and creates new one atomically. If any step fails, everything rolls back.';
