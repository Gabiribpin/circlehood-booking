import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  'supabase',
  'migrations',
  '20260304000006_add_professional_id_notifications.sql'
);

describe('Notifications table multi-tenant isolation (#110)', () => {
  it('migration file exists', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  describe('migration content', () => {
    const migration = readFileSync(MIGRATION_PATH, 'utf-8');

    it('adds professional_id column with FK to professionals', () => {
      expect(migration).toContain('ALTER TABLE notifications');
      expect(migration).toContain(
        'professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE'
      );
    });

    it('back-fills professional_id from professionals.user_id', () => {
      expect(migration).toMatch(/UPDATE notifications[\s\S]*?SET professional_id = p\.id/);
    });

    it('creates index on professional_id', () => {
      expect(migration).toContain('idx_notifications_professional');
    });

    it('updates RLS policy to use professional_id subquery', () => {
      expect(migration).toContain(
        'SELECT id FROM professionals WHERE user_id = auth.uid()'
      );
    });

    it('drops old RLS policy before creating new one', () => {
      expect(migration).toContain('DROP POLICY IF EXISTS');
    });

    it('preserves user_id fallback for backwards compatibility', () => {
      expect(migration).toContain('OR user_id = auth.uid()');
    });
  });
});
