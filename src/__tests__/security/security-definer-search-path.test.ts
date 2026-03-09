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
  '20260309000002_security_definer_search_path.sql'
);

describe('SECURITY DEFINER functions hardening (#458)', () => {
  it('migration file exists', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  describe('migration content', () => {
    const migration = readFileSync(MIGRATION_PATH, 'utf-8');

    it('recreates all 4 SECURITY DEFINER functions', () => {
      const functions = [
        'initialize_default_sections',
        'reschedule_booking',
        'bulk_update_page_sections',
        'cleanup_expired_verification_tokens',
      ];
      for (const fn of functions) {
        expect(migration).toContain(`CREATE OR REPLACE FUNCTION ${fn}`);
      }
    });

    it('all SECURITY DEFINER functions have SET search_path = public', () => {
      // Count SECURITY DEFINER occurrences
      const definerCount = (migration.match(/SECURITY DEFINER/g) || []).length;
      expect(definerCount).toBe(4);

      // Count SET search_path = public occurrences
      const searchPathCount = (migration.match(/SET search_path = public/g) || []).length;
      expect(searchPathCount).toBe(4);
    });

    it('bulk_update_page_sections has ownership check', () => {
      expect(migration).toContain(
        'WHERE id = p_professional_id AND user_id = auth.uid()'
      );
      expect(migration).toContain("RAISE EXCEPTION 'unauthorized'");
    });

    it('no SECURITY DEFINER without search_path', () => {
      // Split by SECURITY DEFINER and check each occurrence is followed by SET search_path
      const parts = migration.split('SECURITY DEFINER');
      // First part is before any SECURITY DEFINER, skip it
      for (let i = 1; i < parts.length; i++) {
        const afterDefiner = parts[i].substring(0, 200); // check next 200 chars
        expect(afterDefiner).toContain('search_path');
      }
    });
  });
});
