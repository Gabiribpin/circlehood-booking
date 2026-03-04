-- Add refund tracking fields to payments table (#115)

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS refunded_amount DECIMAL(10,2) DEFAULT 0;
