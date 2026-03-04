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
  '20260304000005_add_professional_id_whatsapp_tables.sql'
);

const SEND_ROUTE_PATH = join(
  __dirname,
  '..',
  '..',
  'app',
  'api',
  'whatsapp',
  'send',
  'route.ts'
);

describe('WhatsApp tables multi-tenant isolation (#109)', () => {
  it('migration file exists', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  describe('migration adds professional_id to all 3 tables', () => {
    const migration = readFileSync(MIGRATION_PATH, 'utf-8');

    it('adds professional_id to whatsapp_conversations', () => {
      expect(migration).toContain('ALTER TABLE whatsapp_conversations');
      expect(migration).toContain(
        'professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE'
      );
    });

    it('adds professional_id to ai_instructions', () => {
      expect(migration).toContain('ALTER TABLE ai_instructions');
    });

    it('adds professional_id to whatsapp_templates', () => {
      expect(migration).toContain('ALTER TABLE whatsapp_templates');
    });

    it('back-fills professional_id from professionals.user_id', () => {
      // All 3 tables must have back-fill UPDATE statements
      const backfillCount = (migration.match(/UPDATE [\s\S]*?SET professional_id = p\.id/g) || [])
        .length;
      expect(backfillCount).toBe(3);
    });

    it('creates indexes on professional_id', () => {
      expect(migration).toContain('idx_whatsapp_conversations_professional');
      expect(migration).toContain('idx_ai_instructions_professional');
      expect(migration).toContain('idx_whatsapp_templates_professional');
    });

    it('updates RLS policies to use professional_id subquery', () => {
      expect(migration).toContain(
        'SELECT id FROM professionals WHERE user_id = auth.uid()'
      );
      // Must drop old policies before creating new ones
      const dropCount = (migration.match(/DROP POLICY IF EXISTS/g) || []).length;
      expect(dropCount).toBeGreaterThanOrEqual(3);
    });

    it('preserves user_id fallback in RLS for backwards compatibility', () => {
      // New policies should still allow user_id = auth.uid() as fallback
      // for rows not yet back-filled
      expect(migration).toContain('OR user_id = auth.uid()');
    });
  });

  describe('whatsapp/send/route.ts uses correct column', () => {
    const sendRoute = readFileSync(SEND_ROUTE_PATH, 'utf-8');

    it('does not filter whatsapp_config by professional_id (column does not exist)', () => {
      // whatsapp_config does NOT have professional_id — must use user_id
      expect(sendRoute).not.toContain("eq('professional_id'");
    });

    it('filters whatsapp_config by user_id', () => {
      expect(sendRoute).toContain("eq('user_id', user.id)");
    });
  });
});
