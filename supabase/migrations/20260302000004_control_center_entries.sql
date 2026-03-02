-- Control Center entries — persists idea/error analyses
CREATE TABLE IF NOT EXISTS control_center_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('idea', 'error')),
  title TEXT NOT NULL,
  form_data JSONB NOT NULL,
  checklist JSONB NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No RLS — admin-only table accessed via service role
CREATE INDEX idx_control_center_entries_resolved_created
  ON control_center_entries (resolved, created_at DESC);
