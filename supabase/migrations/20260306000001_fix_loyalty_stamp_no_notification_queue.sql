-- Fix: add_loyalty_stamp_on_completion referencia notification_queue (dropada em 20260303000007)
-- Qualquer booking marcado como 'completed' causava crash:
--   "relation notification_queue does not exist"
--
-- Correção: recriar a função SEM o INSERT em notification_queue.
-- A lógica de loyalty (stamps, rewards, transactions) permanece intacta.

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
