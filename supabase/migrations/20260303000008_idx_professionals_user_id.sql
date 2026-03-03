-- Issue #40: Add missing index on professionals.user_id
-- Every RLS policy does a subquery WHERE user_id = auth.uid() on this table.
-- Without an index, every authenticated request triggers a full table scan.
CREATE INDEX IF NOT EXISTS idx_professionals_user_id ON professionals(user_id);
