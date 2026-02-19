ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by        VARCHAR(50),
  ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ;

COMMENT ON COLUMN bookings.cancellation_reason IS 'Motivo do cancelamento informado pelo profissional';
COMMENT ON COLUMN bookings.cancelled_by        IS 'Quem cancelou: professional ou client';
COMMENT ON COLUMN bookings.cancelled_at        IS 'Quando foi cancelado';
