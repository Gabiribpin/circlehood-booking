-- Fix: notification_queue é uma fila morta — nunca processada por nenhum cron.
-- Notificações reais são enviadas via fire-and-forget (Evolution API + Resend).
-- Trigger notify_waitlist_on_cancellation inseria na fila sem efeito.
--
-- Esta migration:
-- 1. Remove o trigger que insere na fila
-- 2. Recria a função SEM o insert na notification_queue (mantém a lógica de waitlist)
-- 3. Dropa a tabela notification_queue e seus índices

-- 1. Dropar trigger (se existir)
DROP TRIGGER IF EXISTS booking_notify_waitlist ON bookings;

-- 2. Recriar função sem insert na notification_queue
-- Mantém apenas a lógica de marcar waitlist como notificado
CREATE OR REPLACE FUNCTION notify_waitlist_on_cancellation()
RETURNS TRIGGER AS $$
DECLARE
  v_waitlist_record RECORD;
BEGIN
  -- Só processa se mudou de confirmado para cancelado
  IF OLD.status = 'confirmed' AND NEW.status = 'cancelled' THEN

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

    -- Se encontrou alguém na waitlist, marca como notificado
    IF v_waitlist_record.id IS NOT NULL THEN
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

-- Recriar trigger com a função atualizada
CREATE TRIGGER booking_notify_waitlist
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_waitlist_on_cancellation();

-- 3. Dropar tabela notification_queue (fila morta)
DROP TABLE IF EXISTS notification_queue CASCADE;
