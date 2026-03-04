import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');

describe('cron_logs RLS restricts access to service_role only (#105)', () => {
  describe('Fix migration', () => {
    const migration = readFileSync(
      join(ROOT, 'supabase/migrations/20260304000004_fix_cron_logs_rls.sql'),
      'utf-8'
    );

    it('drops the permissive USING(true) policy', () => {
      expect(migration).toContain('DROP POLICY IF EXISTS');
      expect(migration).toContain('Sistema pode gerenciar cron logs');
      expect(migration).toContain('cron_logs');
    });

    it('does not create any new permissive policy', () => {
      expect(migration).not.toContain('CREATE POLICY');
      expect(migration).not.toContain('USING (true)');
    });
  });

  describe('Original migration has RLS enabled', () => {
    const original = readFileSync(
      join(ROOT, 'supabase/migrations/20250217000000_sprint7_automations.sql'),
      'utf-8'
    );

    it('cron_logs has RLS enabled (so dropping policy blocks all non-service_role)', () => {
      expect(original).toContain('ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY');
    });
  });

  describe('Cron routes use service_role key (not anon)', () => {
    // Verify cron routes create their own admin client (service_role)
    // rather than using the request-scoped anon client
    const cronFiles = [
      'src/app/api/cron/send-reminders/route.ts',
      'src/app/api/cron/send-retention-emails/route.ts',
      'src/app/api/cron/cleanup-tokens/route.ts',
    ];

    for (const file of cronFiles) {
      it(`${file.split('/').pop()} uses SUPABASE_SERVICE_ROLE_KEY`, () => {
        const content = readFileSync(join(ROOT, file), 'utf-8');
        expect(content).toContain('SUPABASE_SERVICE_ROLE_KEY');
      });
    }
  });
});
