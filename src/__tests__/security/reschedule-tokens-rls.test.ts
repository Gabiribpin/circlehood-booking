import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('reschedule_tokens RLS security', () => {
  const migrationDir = path.resolve('supabase/migrations');

  it('public USING(true) policy is dropped by fix migration', () => {
    const fixMigration = fs.readFileSync(
      path.join(migrationDir, '20260303000006_fix_reschedule_tokens_rls.sql'),
      'utf-8'
    );

    expect(fixMigration).toContain('DROP POLICY IF EXISTS "Acesso público via token"');
    expect(fixMigration).toContain('DROP POLICY IF EXISTS "Sistema pode criar tokens"');
    expect(fixMigration).toContain('DROP POLICY IF EXISTS "Sistema pode atualizar tokens"');
  });

  it('reschedule route uses createAdminClient (not anon createClient)', () => {
    const routeSource = fs.readFileSync(
      path.resolve('src/app/api/reschedule/[token]/route.ts'),
      'utf-8'
    );

    expect(routeSource).toContain("createAdminClient");
    expect(routeSource).not.toMatch(/from '@\/lib\/supabase\/server'/);
  });

  it('reschedule change route uses createAdminClient (not anon createClient)', () => {
    const changeSource = fs.readFileSync(
      path.resolve('src/app/api/reschedule/[token]/change/route.ts'),
      'utf-8'
    );

    expect(changeSource).toContain("createAdminClient");
    expect(changeSource).not.toMatch(/from '@\/lib\/supabase\/server'/);
  });

  it('reschedule cancel route already uses createAdminClient', () => {
    const cancelSource = fs.readFileSync(
      path.resolve('src/app/api/reschedule/[token]/cancel/route.ts'),
      'utf-8'
    );

    expect(cancelSource).toContain("createAdminClient");
  });
});
