-- Remover default fixo 'IE' para suportar múltiplos países
ALTER TABLE professionals
  ALTER COLUMN payment_country DROP DEFAULT;
