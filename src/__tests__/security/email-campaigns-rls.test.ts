import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');

describe('Email campaigns RLS uses professionals subquery (#102)', () => {
  describe('Migration fix exists', () => {
    const migration = readFileSync(
      join(ROOT, 'supabase/migrations/20260304000002_fix_email_campaigns_rls.sql'),
      'utf-8'
    );

    it('drops all 5 old policies', () => {
      const drops = migration.match(/DROP POLICY IF EXISTS/g) || [];
      expect(drops.length).toBe(5);
    });

    it('creates 5 new policies with professionals subquery', () => {
      const creates = migration.match(/CREATE POLICY/g) || [];
      expect(creates.length).toBe(5);
    });

    it('all policies use professionals WHERE user_id = auth.uid()', () => {
      const subqueries = migration.match(
        /SELECT id FROM professionals WHERE user_id = auth\.uid\(\)/g
      ) || [];
      // 4 for email_campaigns + 1 nested for email_campaign_recipients
      expect(subqueries.length).toBe(5);
    });

    it('no policy uses direct professional_id = auth.uid()', () => {
      // Should NOT have the old broken pattern
      expect(migration).not.toMatch(/professional_id\s*=\s*auth\.uid\(\)/);
    });

    it('covers SELECT, INSERT, UPDATE, DELETE for email_campaigns', () => {
      expect(migration).toContain('FOR SELECT');
      expect(migration).toContain('FOR INSERT');
      expect(migration).toContain('FOR UPDATE');
      expect(migration).toContain('FOR DELETE');
    });

    it('covers email_campaign_recipients SELECT', () => {
      expect(migration).toContain('email_campaign_recipients FOR SELECT');
    });
  });

  describe('API routes use professional.id instead of user.id', () => {
    it('email-campaigns/route.ts queries by professional.id', () => {
      const content = readFileSync(
        join(ROOT, 'src/app/api/email-campaigns/route.ts'),
        'utf-8'
      );
      // Should lookup professional first
      expect(content).toContain(".eq('user_id', user.id)");
      expect(content).toContain(".eq('professional_id', professional.id)");
      // Should NOT use user.id as professional_id directly
      expect(content).not.toContain("professional_id: user.id");
      expect(content).not.toContain(".eq('professional_id', user.id)");
    });

    it('email-campaigns/[id]/send/route.ts uses professional.id', () => {
      const content = readFileSync(
        join(ROOT, 'src/app/api/email-campaigns/[id]/send/route.ts'),
        'utf-8'
      );
      // Should lookup professional first
      expect(content).toContain(".eq('user_id', user.id)");
      expect(content).toContain(".eq('professional_id', professional.id)");
      // Should NOT use user.id as professional_id
      expect(content).not.toContain("p_professional_id: user.id");
      expect(content).not.toContain(".eq('professional_id', user.id)");
    });

    it('RPC get_contacts_by_segment receives professional.id', () => {
      const content = readFileSync(
        join(ROOT, 'src/app/api/email-campaigns/[id]/send/route.ts'),
        'utf-8'
      );
      expect(content).toContain('p_professional_id: professional.id');
    });
  });
});
