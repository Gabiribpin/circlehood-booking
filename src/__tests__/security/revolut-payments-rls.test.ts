import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');

describe('Revolut payments RLS uses professionals subquery (#104)', () => {
  describe('Migration fix', () => {
    const migration = readFileSync(
      join(ROOT, 'supabase/migrations/20260304000003_fix_revolut_payments_rls.sql'),
      'utf-8'
    );

    it('drops the old policy', () => {
      expect(migration).toContain('DROP POLICY IF EXISTS');
      expect(migration).toContain('revolut_payments');
    });

    it('creates new policy with professionals subquery', () => {
      expect(migration).toContain('CREATE POLICY');
      expect(migration).toContain(
        'SELECT id FROM professionals WHERE user_id = auth.uid()'
      );
    });

    it('does not use direct professional_id = auth.uid()', () => {
      expect(migration).not.toMatch(/professional_id\s*=\s*auth\.uid\(\)/);
    });
  });

  describe('API route uses professional.id', () => {
    const content = readFileSync(
      join(ROOT, 'src/app/api/payments/revolut/create/route.ts'),
      'utf-8'
    );

    it('looks up professional by user_id', () => {
      expect(content).toContain(".eq('user_id', user.id)");
    });

    it('does not query professionals by id = user.id', () => {
      // The old broken pattern: .eq('id', user.id) on professionals table
      expect(content).not.toMatch(/\.eq\('id', user\.id\)/);
    });

    it('stores professional.id as professional_id', () => {
      expect(content).toContain('professional_id: professional.id');
      expect(content).not.toContain('professional_id: user.id');
    });

    it('passes professional.id to createSubscriptionOrder', () => {
      expect(content).toContain('professional.id,');
      expect(content).not.toMatch(/createSubscriptionOrder\(\s*user\.id/);
    });
  });
});
