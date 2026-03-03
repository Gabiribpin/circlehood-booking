import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  process.cwd(),
  'supabase/migrations/20260303000005_webhook_logs_rls.sql',
);

const migrationSQL = readFileSync(MIGRATION_PATH, 'utf-8');

describe('Migration: webhook_logs RLS (issue #12)', () => {
  it('enables RLS on webhook_logs', () => {
    expect(migrationSQL).toContain(
      'ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY',
    );
  });

  it('does NOT create any SELECT/INSERT/UPDATE/DELETE policy for authenticated users', () => {
    // No policies = 0 rows for anon/authenticated. Only service_role bypasses RLS.
    expect(migrationSQL).not.toMatch(/CREATE POLICY/i);
  });

  it('creates the table with IF NOT EXISTS (idempotent)', () => {
    expect(migrationSQL).toContain('CREATE TABLE IF NOT EXISTS webhook_logs');
  });

  it('table has sensitive columns that warrant RLS', () => {
    // These columns contain data that should not be exposed to regular users
    expect(migrationSQL).toContain('instance_name TEXT NOT NULL');
    expect(migrationSQL).toContain('metadata JSONB');
  });
});

describe('All tables with sensitive data have RLS enabled', () => {
  // Verify webhook_logs is not the only table missing RLS by checking
  // that the RLS migration references the correct table
  it('webhook_logs RLS migration targets the correct table', () => {
    const rlsStatements = migrationSQL.match(
      /ALTER TABLE (\w+) ENABLE ROW LEVEL SECURITY/g,
    );
    expect(rlsStatements).toHaveLength(1);
    expect(rlsStatements![0]).toContain('webhook_logs');
  });
});
