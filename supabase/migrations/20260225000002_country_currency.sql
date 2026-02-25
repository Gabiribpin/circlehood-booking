-- Add country and currency columns to professionals table
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'IE';
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'eur';
