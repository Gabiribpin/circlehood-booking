-- =====================================================
-- FIX: Corrigir triggers quebrados na tabela bookings
-- Data: 2026-02-18
-- Problema: Trigger usava nomes de coluna errados
--   contact_name → client_name
--   contact_phone → client_phone
--   contact_email → client_email
--   booking_time  → start_time
-- =====================================================

-- Fix 1: sync_booking_to_calendar (dispara em INSERT e UPDATE — bloqueia todos os bookings)
CREATE OR REPLACE FUNCTION sync_booking_to_calendar()
RETURNS TRIGGER AS $$
DECLARE
  v_professional_id uuid;
  v_service_name text;
  v_event_title text;
BEGIN
  SELECT b.professional_id, s.name
  INTO v_professional_id, v_service_name
  FROM bookings b
  LEFT JOIN services s ON s.id = b.service_id
  WHERE b.id = NEW.id;

  v_event_title := COALESCE(v_service_name, 'Agendamento') || ' - ' || NEW.client_name;

  INSERT INTO calendar_events (
    professional_id, booking_id, title, description,
    start_time, end_time, location, source, synced_to_google
  )
  VALUES (
    v_professional_id,
    NEW.id,
    v_event_title,
    'Cliente: ' || NEW.client_name || E'\nTelefone: ' || COALESCE(NEW.client_phone, ''),
    (NEW.booking_date::date + NEW.start_time::time)::timestamptz,
    (NEW.booking_date::date + NEW.end_time::time)::timestamptz,
    NULL,
    'circlehood',
    false
  )
  ON CONFLICT (booking_id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    synced_to_google = false,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix 2: add_loyalty_stamp_on_completion (dispara em UPDATE — bloqueia marcação como completed)
CREATE OR REPLACE FUNCTION add_loyalty_stamp_on_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_loyalty_card RECORD;
  v_new_stamps integer;
  v_new_rewards integer;
BEGIN
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN

    INSERT INTO loyalty_cards (
      professional_id,
      contact_id,
      contact_phone,
      contact_name,
      current_stamps,
      total_stamps
    ) VALUES (
      NEW.professional_id,
      NEW.contact_id,
      NEW.client_phone,
      NEW.client_name,
      1,
      1
    )
    ON CONFLICT (professional_id, contact_phone)
    DO UPDATE SET
      current_stamps = loyalty_cards.current_stamps + 1,
      total_stamps = loyalty_cards.total_stamps + 1,
      updated_at = now()
    RETURNING * INTO v_loyalty_card;

    v_new_rewards := (v_loyalty_card.current_stamps / 10)::integer;

    IF v_new_rewards > 0 THEN
      UPDATE loyalty_cards SET
        current_stamps = v_loyalty_card.current_stamps % 10,
        rewards_available = rewards_available + v_new_rewards,
        updated_at = now()
      WHERE id = v_loyalty_card.id;

      INSERT INTO loyalty_transactions (loyalty_card_id, booking_id, type, stamps_change, notes)
      VALUES (
        v_loyalty_card.id, NEW.id, 'reward_earned', v_new_rewards,
        format('Ganhou %s recompensa(s)!', v_new_rewards)
      );

      INSERT INTO notification_queue (
        professional_id, type, recipient_name, recipient_phone, recipient_email,
        message_template, message_data, language
      ) VALUES (
        NEW.professional_id,
        'loyalty_reward',
        NEW.client_name,
        NEW.client_phone,
        NEW.client_email,
        'loyalty_reward_earned',
        jsonb_build_object('rewards_count', v_new_rewards, 'card_token', v_loyalty_card.card_token),
        'pt'
      );
    END IF;

    INSERT INTO loyalty_transactions (loyalty_card_id, booking_id, type, stamps_change, notes)
    VALUES (
      v_loyalty_card.id, NEW.id, 'stamp_earned', 1,
      'Carimbo ganho por serviço completado'
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
