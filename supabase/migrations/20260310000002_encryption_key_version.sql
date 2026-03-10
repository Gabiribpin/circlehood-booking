-- Add encryption_key_version to professionals for PII key rotation tracking
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS encryption_key_version smallint NOT NULL DEFAULT 1;

COMMENT ON COLUMN professionals.encryption_key_version IS 'Version of encryption key used for PII fields (payment_full_name, payment_dob, payment_iban, payment_address_line1, payment_address_line2)';
