import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #187: reschedule_tokens RLS SELECT USING(true)
 * exposes all tokens to any anon user.
 *
 * Fix: routes switched to createAdminClient(), RLS locked down to
 * professional ownership only.
 */

const fixMigrationPath = resolve(
  'supabase/migrations/20260306000002_fix_reschedule_tokens_rls.sql'
);
const routePath = resolve('src/app/api/reschedule/[token]/route.ts');
const changePath = resolve('src/app/api/reschedule/[token]/change/route.ts');
const cancelPath = resolve('src/app/api/reschedule/[token]/cancel/route.ts');

describe('reschedule_tokens RLS fix (issue #187)', () => {
  it('fix migration exists', () => {
    expect(existsSync(fixMigrationPath)).toBe(true);
  });

  it('drops the permissive SELECT USING(true) policy', () => {
    const sql = readFileSync(fixMigrationPath, 'utf-8');
    expect(sql).toContain('DROP POLICY IF EXISTS "Acesso público via token"');
  });

  it('drops the permissive INSERT WITH CHECK(true) policy', () => {
    const sql = readFileSync(fixMigrationPath, 'utf-8');
    expect(sql).toContain('DROP POLICY IF EXISTS "Sistema pode criar tokens"');
  });

  it('drops the permissive UPDATE USING(true) policy', () => {
    const sql = readFileSync(fixMigrationPath, 'utf-8');
    expect(sql).toContain('DROP POLICY IF EXISTS "Sistema pode atualizar tokens"');
  });

  it('new SELECT policy restricts to professional ownership via booking', () => {
    const sql = readFileSync(fixMigrationPath, 'utf-8');
    expect(sql).toContain('FOR SELECT');
    expect(sql).toContain('b.professional_id');
    expect(sql).toContain('auth.uid()');
    expect(sql).not.toMatch(/FOR SELECT[\s\S]*?USING\s*\(\s*true\s*\)/);
  });

  it('new UPDATE policy restricts to professional ownership via booking', () => {
    const sql = readFileSync(fixMigrationPath, 'utf-8');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).not.toMatch(/FOR UPDATE[\s\S]*?USING\s*\(\s*true\s*\)/);
  });

  it('does not create a public INSERT policy', () => {
    const sql = readFileSync(fixMigrationPath, 'utf-8');
    expect(sql).not.toContain('FOR INSERT');
  });
});

describe('reschedule routes use admin client (issue #187)', () => {
  it('GET route uses createAdminClient (not createClient)', () => {
    const source = readFileSync(routePath, 'utf-8');
    expect(source).toContain("import { createAdminClient } from '@/lib/supabase/admin'");
    expect(source).toContain('createAdminClient()');
    expect(source).not.toContain("from '@/lib/supabase/server'");
  });

  it('change route uses createAdminClient (not createClient)', () => {
    const source = readFileSync(changePath, 'utf-8');
    expect(source).toContain("import { createAdminClient } from '@/lib/supabase/admin'");
    expect(source).toContain('createAdminClient()');
    expect(source).not.toContain("from '@/lib/supabase/server'");
  });

  it('cancel route already uses createAdminClient', () => {
    const source = readFileSync(cancelPath, 'utf-8');
    expect(source).toContain("import { createAdminClient } from '@/lib/supabase/admin'");
  });

  it('all three routes query reschedule_tokens and check for errors', () => {
    for (const path of [routePath, changePath, cancelPath]) {
      const source = readFileSync(path, 'utf-8');
      expect(source).toContain(".from('reschedule_tokens')");
      expect(source).toContain('tokenError');
      expect(source).toContain("Token inválido");
    }
  });
});
