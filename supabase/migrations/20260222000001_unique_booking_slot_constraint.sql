-- Proteção contra race condition em agendamentos
--
-- Problema: o check-then-insert em /api/bookings tem uma janela de race condition.
-- Se 2 clientes fazem POST simultaneamente para o mesmo slot, ambos passam pelo
-- SELECT de conflito antes de qualquer INSERT, resultando em 2 bookings confirmados
-- para o mesmo horário (overbooking).
--
-- Solução: partial unique index garante atomicidade no banco.
-- Se 2 INSERTs chegarem simultâneos, o banco aceita o primeiro e rejeita
-- o segundo com erro 23505 (unique violation), que a API trata como 409.

-- 1. Remover duplicatas existentes (mantém o mais antigo)
--    Improvável em produção, mas seguro para rodar em qualquer estado.
DELETE FROM bookings a
  USING bookings b
  WHERE a.professional_id = b.professional_id
    AND a.booking_date = b.booking_date
    AND a.start_time = b.start_time
    AND a.status = 'confirmed'
    AND b.status = 'confirmed'
    AND a.created_at > b.created_at;

-- 2. Partial unique index: apenas 1 booking confirmado por slot
--    Bookings cancelados/pendentes não bloqueiam o slot.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_booking_confirmed_slot
  ON bookings (professional_id, booking_date, start_time)
  WHERE status = 'confirmed';

COMMENT ON INDEX uidx_booking_confirmed_slot IS
  'Previne overbooking por race condition: garante no máximo 1 booking confirmado por slot.';
