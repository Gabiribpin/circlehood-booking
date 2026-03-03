import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #40: Missing index on professionals.user_id
 *
 * Every RLS policy queries professionals WHERE user_id = auth.uid().
 * Without an index this causes a full table scan on every authenticated request.
 */

describe('professionals.user_id index (issue #40)', () => {
  const migrationsDir = resolve('supabase/migrations');

  it('migration file exists for idx_professionals_user_id', () => {
    const files = readdirSync(migrationsDir);
    const indexMigration = files.find((f) => f.includes('idx_professionals_user_id'));
    expect(indexMigration).toBeDefined();
  });

  it('migration creates the index on professionals(user_id)', () => {
    const files = readdirSync(migrationsDir);
    const indexMigration = files.find((f) => f.includes('idx_professionals_user_id'))!;
    const sql = readFileSync(resolve(migrationsDir, indexMigration), 'utf-8');

    expect(sql).toContain('CREATE INDEX');
    expect(sql).toContain('idx_professionals_user_id');
    expect(sql).toContain('professionals');
    expect(sql).toContain('user_id');
  });

  it('migration uses IF NOT EXISTS for idempotency', () => {
    const files = readdirSync(migrationsDir);
    const indexMigration = files.find((f) => f.includes('idx_professionals_user_id'))!;
    const sql = readFileSync(resolve(migrationsDir, indexMigration), 'utf-8');

    expect(sql).toContain('IF NOT EXISTS');
  });

  it('RLS policies reference professionals.user_id (confirming the index is needed)', () => {
    // Scan all migrations for RLS policies that reference user_id = auth.uid()
    const files = readdirSync(migrationsDir);
    let rlsPolicyCount = 0;

    for (const file of files) {
      const sql = readFileSync(resolve(migrationsDir, file), 'utf-8');
      // Count policies that do subquery on professionals WHERE user_id = auth.uid()
      const matches = sql.match(/professionals.*user_id\s*=\s*auth\.uid\(\)/gi);
      if (matches) rlsPolicyCount += matches.length;
    }

    // There should be multiple RLS policies depending on this column
    expect(rlsPolicyCount).toBeGreaterThan(0);
  });
});
