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
  '20260304000009_whatsapp_messages_update_delete_policies.sql'
);

describe('whatsapp_messages UPDATE/DELETE policies (#116)', () => {
  it('migration file exists', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  describe('migration content', () => {
    const migration = readFileSync(MIGRATION_PATH, 'utf-8');

    it('creates UPDATE policy', () => {
      expect(migration).toContain('ON whatsapp_messages FOR UPDATE');
    });

    it('creates DELETE policy', () => {
      expect(migration).toContain('ON whatsapp_messages FOR DELETE');
    });

    it('filters by conversation ownership via subquery', () => {
      const subqueryCount = (
        migration.match(/whatsapp_conversations\.user_id = auth\.uid\(\)/g) || []
      ).length;
      expect(subqueryCount).toBe(2);
    });

    it('joins on conversation_id', () => {
      const joinCount = (
        migration.match(/whatsapp_conversations\.id = whatsapp_messages\.conversation_id/g) || []
      ).length;
      expect(joinCount).toBe(2);
    });
  });
});
