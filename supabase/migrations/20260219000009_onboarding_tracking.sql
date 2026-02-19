ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS onboarding_completed    BOOLEAN   DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN professionals.onboarding_completed    IS 'Se o profissional concluiu o wizard de onboarding';
COMMENT ON COLUMN professionals.onboarding_completed_at IS 'Quando concluiu o onboarding';
