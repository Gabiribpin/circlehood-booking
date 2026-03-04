import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #141: Missing indexes on user_id columns used by RLS
 *
 * RLS policies on whatsapp_config, ai_instructions, whatsapp_templates
 * do `WHERE user_id = auth.uid()` but had no index, causing full table scans.
 */

describe('user_id indexes for RLS tables (issue #141)', () => {
  const migrationsDir = resolve('supabase/migrations');
  const allMigrations = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .map(f => readFileSync(resolve(migrationsDir, f), 'utf-8'))
    .join('\n');

  it('has index on whatsapp_config.user_id', () => {
    expect(allMigrations).toContain('idx_whatsapp_config_user_id');
    expect(allMigrations).toContain('ON whatsapp_config(user_id)');
  });

  it('has index on ai_instructions.user_id', () => {
    expect(allMigrations).toContain('idx_ai_instructions_user_id');
    expect(allMigrations).toContain('ON ai_instructions(user_id)');
  });

  it('has index on whatsapp_templates.user_id', () => {
    expect(allMigrations).toContain('idx_whatsapp_templates_user_id');
    expect(allMigrations).toContain('ON whatsapp_templates(user_id)');
  });

  it('notifications already has user_id index', () => {
    expect(allMigrations).toContain('idx_notifications_user');
    expect(allMigrations).toContain('ON notifications(user_id');
  });

  it('professionals already has user_id index', () => {
    expect(allMigrations).toContain('idx_professionals_user_id');
    expect(allMigrations).toContain('ON professionals(user_id)');
  });

  it('uses IF NOT EXISTS for idempotency', () => {
    const migration = readFileSync(
      resolve(migrationsDir, '20260304000011_idx_user_id_rls_tables.sql'),
      'utf-8'
    );
    const lines = migration.split('\n').filter(l => l.includes('CREATE INDEX'));
    for (const line of lines) {
      expect(line).toContain('IF NOT EXISTS');
    }
  });
});
