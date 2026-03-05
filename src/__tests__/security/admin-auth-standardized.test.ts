import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { globSync } from 'fs';

/**
 * Tests for Issue #155: Standardize admin auth (3 different patterns)
 *
 * Admin routes used 3 patterns: validateAdminToken, x-admin-secret header,
 * and ADMIN_EMAIL check. Now all use validateAdminToken except intentional
 * SETUP_SECRET endpoints (one-time setup scripts).
 */

// All admin API routes that should use validateAdminToken
const adminRoutes = [
  'src/app/api/admin/bot-e2e-toggle/route.ts',
  'src/app/api/admin/control-center/route.ts',
  'src/app/api/admin/control-center/[id]/resolve/route.ts',
  'src/app/api/admin/evolution/check-connection/route.ts',
  'src/app/api/admin/evolution/create-instance/route.ts',
  'src/app/api/admin/github/issues/route.ts',
  'src/app/api/admin/github/project/route.ts',
  'src/app/api/admin/inbox/route.ts',
  'src/app/api/admin/leads/[id]/message/route.ts',
  'src/app/api/admin/leads/[id]/toggle-bot/route.ts',
  'src/app/api/admin/restore-account/route.ts',
  'src/app/api/admin/clear-bot-cache/route.ts',
  'src/app/api/admin/support/tickets/[id]/route.ts',
  'src/app/api/admin/support/tickets/[id]/reply/route.ts',
];

// Setup endpoints intentionally use SETUP_SECRET (not validateAdminToken)
const setupRoutes = [
  'src/app/api/admin/setup-storage/route.ts',
  'src/app/api/admin/encrypt-existing-tokens/route.ts',
  'src/app/api/admin/fix-triggers/route.ts',
];

describe('Admin auth standardized to validateAdminToken (issue #155)', () => {
  for (const route of adminRoutes) {
    describe(route.split('api/admin/')[1], () => {
      const source = readFileSync(resolve(route), 'utf-8');

      it('uses validateAdminToken', () => {
        expect(source).toContain('validateAdminToken');
      });

      it('does NOT use x-admin-secret header pattern', () => {
        expect(source).not.toContain('x-admin-secret');
      });

      it('does NOT use ADMIN_EMAIL comparison', () => {
        expect(source).not.toContain('ADMIN_EMAIL');
        expect(source).not.toContain('user.email !== adminEmail');
      });
    });
  }

  describe('previously migrated routes', () => {
    it('clear-bot-cache no longer uses CRON_SECRET', () => {
      const source = readFileSync(resolve('src/app/api/admin/clear-bot-cache/route.ts'), 'utf-8');
      expect(source).not.toContain('CRON_SECRET');
      expect(source).toContain('validateAdminToken');
    });

    it('support/tickets/[id] no longer uses ADMIN_EMAIL', () => {
      const source = readFileSync(resolve('src/app/api/admin/support/tickets/[id]/route.ts'), 'utf-8');
      expect(source).not.toContain('ADMIN_EMAIL');
      expect(source).toContain('validateAdminToken');
    });

    it('support/tickets/[id]/reply no longer uses ADMIN_EMAIL', () => {
      const source = readFileSync(resolve('src/app/api/admin/support/tickets/[id]/reply/route.ts'), 'utf-8');
      expect(source).not.toContain('ADMIN_EMAIL');
      expect(source).toContain('validateAdminToken');
    });
  });

  describe('setup routes intentionally use SETUP_SECRET (exempt)', () => {
    for (const route of setupRoutes) {
      it(`${route.split('api/admin/')[1]} uses SETUP_SECRET`, () => {
        const source = readFileSync(resolve(route), 'utf-8');
        expect(source).toContain('SETUP_SECRET');
      });
    }
  });
});
