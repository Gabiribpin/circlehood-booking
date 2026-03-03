import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #21: cron_logs sem professional_id — tabela global sem isolamento por tenant
 *
 * Adds nullable professional_id column to cron_logs for per-tenant filtering.
 * Per-tenant crons include professional_ids in metadata for traceability.
 */

describe('cron_logs professional_id column (issue #21)', () => {
  const migrationsDir = resolve('supabase/migrations');

  it('migration file exists for cron_logs_professional_id', () => {
    const files = readdirSync(migrationsDir);
    const migration = files.find((f) => f.includes('cron_logs_professional_id'));
    expect(migration).toBeDefined();
  });

  it('migration adds professional_id column to cron_logs', () => {
    const files = readdirSync(migrationsDir);
    const migration = files.find((f) => f.includes('cron_logs_professional_id'))!;
    const sql = readFileSync(resolve(migrationsDir, migration), 'utf-8');

    expect(sql).toContain('ALTER TABLE cron_logs');
    expect(sql).toContain('professional_id');
    expect(sql).toContain('UUID');
    expect(sql).toContain('REFERENCES professionals(id)');
  });

  it('migration uses IF NOT EXISTS for idempotency', () => {
    const files = readdirSync(migrationsDir);
    const migration = files.find((f) => f.includes('cron_logs_professional_id'))!;
    const sql = readFileSync(resolve(migrationsDir, migration), 'utf-8');

    expect(sql).toContain('IF NOT EXISTS');
  });

  it('migration adds an index on professional_id', () => {
    const files = readdirSync(migrationsDir);
    const migration = files.find((f) => f.includes('cron_logs_professional_id'))!;
    const sql = readFileSync(resolve(migrationsDir, migration), 'utf-8');

    expect(sql).toContain('CREATE INDEX');
    expect(sql).toContain('idx_cron_logs_professional_id');
  });

  it('column is nullable (global crons have no professional_id)', () => {
    const files = readdirSync(migrationsDir);
    const migration = files.find((f) => f.includes('cron_logs_professional_id'))!;
    const sql = readFileSync(resolve(migrationsDir, migration), 'utf-8');

    // Should NOT contain NOT NULL constraint
    expect(sql).not.toMatch(/professional_id\s+UUID\s+NOT\s+NULL/i);
  });

  it('uses ON DELETE SET NULL (professional deletion should not lose logs)', () => {
    const files = readdirSync(migrationsDir);
    const migration = files.find((f) => f.includes('cron_logs_professional_id'))!;
    const sql = readFileSync(resolve(migrationsDir, migration), 'utf-8');

    expect(sql).toContain('ON DELETE SET NULL');
  });
});

describe('per-tenant crons include professional_ids in metadata', () => {
  const cronDir = resolve('src/app/api/cron');

  it('send-reminders includes professional_ids in cron_logs metadata', () => {
    const source = readFileSync(resolve(cronDir, 'send-reminders/route.ts'), 'utf-8');
    expect(source).toContain('professional_ids');
  });

  it('send-maintenance-reminders includes professional_ids in cron_logs metadata', () => {
    const source = readFileSync(resolve(cronDir, 'send-maintenance-reminders/route.ts'), 'utf-8');
    expect(source).toContain('professional_ids');
  });

  it('process-deletions includes professional_ids in cron_logs metadata', () => {
    const source = readFileSync(resolve(cronDir, 'process-deletions/route.ts'), 'utf-8');
    expect(source).toContain('professional_ids');
  });

  it('send-retention-emails includes professional_ids in cron_logs metadata', () => {
    const source = readFileSync(resolve(cronDir, 'send-retention-emails/route.ts'), 'utf-8');
    expect(source).toContain('professional_ids');
  });

  it('send-trial-expiration-notifications includes professional_ids in cron_logs metadata', () => {
    const source = readFileSync(resolve(cronDir, 'send-trial-expiration-notifications/route.ts'), 'utf-8');
    expect(source).toContain('professional_ids');
  });

  it('global crons do NOT include professional_ids (they are system-wide)', () => {
    const globalCrons = ['cleanup-tokens', 'refresh-analytics', 'expire-waitlist'];
    for (const cron of globalCrons) {
      const source = readFileSync(resolve(cronDir, `${cron}/route.ts`), 'utf-8');
      expect(source).not.toContain('professional_ids');
    }
  });
});
