-- =====================================================
-- Transação atômica: confirmar booking + atualizar payment
-- Data: 2026-03-03
-- Issue: #4
-- Problema: Webhook Stripe faz 2 queries separadas sem transação.
--   Se a segunda falha, booking fica confirmed sem payment succeeded.
-- Solução: RPC function que faz ambos os updates numa transação.
-- =====================================================

CREATE OR REPLACE FUNCTION confirm_booking_payment(
  p_booking_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_booking_updated boolean;
  v_payment_updated boolean;
BEGIN
  -- Update booking: pending_payment → confirmed
  UPDATE bookings
  SET status = 'confirmed', updated_at = now()
  WHERE id = p_booking_id
    AND status = 'pending_payment';

  v_booking_updated := FOUND;

  -- Update payment: pending → succeeded
  UPDATE payments
  SET status = 'succeeded',
      stripe_payment_intent_id = COALESCE(p_payment_intent_id, stripe_payment_intent_id),
      updated_at = now()
  WHERE stripe_checkout_session_id = p_checkout_session_id;

  v_payment_updated := FOUND;

  -- Se nenhum dos dois atualizou, não é erro (idempotência — webhook retry)
  RETURN jsonb_build_object(
    'booking_updated', v_booking_updated,
    'payment_updated', v_payment_updated
  );
END;
$$ LANGUAGE plpgsql;
