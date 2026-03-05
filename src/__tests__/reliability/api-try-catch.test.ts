import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #207: All API routes must have top-level try/catch
 * to return structured JSON 500 errors instead of unhandled rejections.
 */

const routesRequiringTryCatch = [
  'src/app/api/admin/clear-bot-cache/route.ts',
  'src/app/api/admin/fix-triggers/route.ts',
  'src/app/api/admin/leads/[id]/toggle-bot/route.ts',
  'src/app/api/admin/setup-storage/route.ts',
  'src/app/api/notifications/retry/route.ts',
  'src/app/api/stripe/checkout/route.ts',
  'src/app/api/stripe/connect/dashboard-link/route.ts',
  'src/app/api/stripe/connect/refresh-onboarding/route.ts',
  'src/app/api/stripe/connect/status/route.ts',
  'src/app/api/stripe/portal/route.ts',
  'src/app/api/support/tickets/[id]/replies/route.ts',
  'src/app/api/email/unsubscribe/route.ts',
  'src/app/api/auth/signout/route.ts',
  'src/app/api/integrations/instagram/connect/route.ts',
];

describe('API routes have try/catch error handling (issue #207)', () => {
  for (const route of routesRequiringTryCatch) {
    const shortName = route.split('api/')[1];

    describe(shortName, () => {
      const source = readFileSync(resolve(route), 'utf-8');

      it('has try/catch block', () => {
        expect(source).toContain('try {');
        expect(source).toContain('} catch');
      });

      it('imports logger', () => {
        expect(source).toContain("from '@/lib/logger'");
      });

      it('logs errors with logger.error', () => {
        expect(source).toContain('logger.error');
      });

      it('returns structured error response on catch', () => {
        // Should return JSON 500 or a redirect (signout special case)
        const hasJson500 = source.includes("{ status: 500 }");
        const hasRedirectFallback = source.includes('NextResponse.redirect');
        expect(hasJson500 || hasRedirectFallback).toBe(true);
      });
    });
  }
});
