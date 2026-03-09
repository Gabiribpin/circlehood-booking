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

const NOT_NULL_MIGRATION_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  'supabase',
  'migrations',
  '20260309000001_bot_config_professional_id_and_not_null.sql'
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
  });

  describe('whatsapp/send/route.ts uses correct column', () => {
    const sendRoute = readFileSync(SEND_ROUTE_PATH, 'utf-8');

    it('filters whatsapp_config by user_id or professional_id', () => {
      // whatsapp_config has both user_id and professional_id (added in migration 20260307000002)
      const usesUserId = sendRoute.includes("eq('user_id', user.id)");
      const usesProfId = sendRoute.includes("eq('professional_id'");
      expect(usesUserId || usesProfId).toBe(true);
    });
  });
});

describe('bot_config + NOT NULL enforcement (#457)', () => {
  it('hardening migration file exists', () => {
    expect(existsSync(NOT_NULL_MIGRATION_PATH)).toBe(true);
  });

  describe('migration content', () => {
    const migration = readFileSync(NOT_NULL_MIGRATION_PATH, 'utf-8');

    it('adds professional_id to bot_config', () => {
      expect(migration).toContain('ALTER TABLE bot_config');
      expect(migration).toContain(
        'professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE'
      );
    });

    it('backfills bot_config professional_id', () => {
      expect(migration).toMatch(/UPDATE bot_config[\s\S]*?SET professional_id = p\.id/);
    });

    it('creates index on bot_config.professional_id', () => {
      expect(migration).toContain('idx_bot_config_professional_id');
    });

    it('sets NOT NULL on professional_id for all 5 tables', () => {
      const tables = [
        'bot_config',
        'whatsapp_config',
        'whatsapp_conversations',
        'ai_instructions',
        'whatsapp_templates',
      ];
      for (const table of tables) {
        expect(migration).toContain(
          `ALTER TABLE ${table} ALTER COLUMN professional_id SET NOT NULL`
        );
      }
    });

    it('removes OR user_id fallback from RLS policies', () => {
      // The hardening migration must NOT contain fallback
      expect(migration).not.toContain('OR user_id = auth.uid()');
    });

    it('uses professional_id subquery in all new RLS policies', () => {
      // Should have multiple policies using the subquery pattern
      const policyCount = (
        migration.match(/SELECT id FROM professionals WHERE user_id = auth\.uid\(\)/g) || []
      ).length;
      // bot_config (2: USING + WITH CHECK) + conversations (2) + ai_instructions (1) + templates (1) + notifications (1)
      expect(policyCount).toBeGreaterThanOrEqual(7);
    });

    it('drops old policies before recreating', () => {
      const dropCount = (migration.match(/DROP POLICY IF EXISTS/g) || []).length;
      // bot_config (1) + conversations (2) + ai_instructions (1) + templates (1) + notifications (1)
      expect(dropCount).toBeGreaterThanOrEqual(6);
    });
  });
});
