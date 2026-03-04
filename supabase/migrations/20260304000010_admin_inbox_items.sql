-- Admin inbox for quick capture of ideas/errors before they become GitHub issues
CREATE TABLE IF NOT EXISTS admin_inbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('idea', 'error')),
  title TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'converted')),
  severity TEXT,
  area TEXT[] DEFAULT '{}',
  needs_info TEXT[] DEFAULT '{}',
  duplicates JSONB DEFAULT '[]',
  github_issue_number INT,
  github_issue_url TEXT
);

-- RLS enabled with deny-all policy — access only via service role (createAdminClient)
ALTER TABLE admin_inbox_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all" ON admin_inbox_items USING (false);

CREATE INDEX idx_admin_inbox_status_created ON admin_inbox_items (status, created_at DESC);
