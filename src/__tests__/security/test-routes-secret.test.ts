import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const API_DIR = join(__dirname, '..', '..', 'app', 'api');

const TEST_ROUTES = [
  join(API_DIR, 'test', 'setup-professional', 'route.ts'),
  join(API_DIR, 'test', 'cleanup-professional', '[id]', 'route.ts'),
  join(API_DIR, 'bookings', 'check', 'route.ts'),
];

describe('Test routes require E2E_TEST_SECRET header (#112)', () => {
  for (const routePath of TEST_ROUTES) {
    const relPath = routePath.replace(API_DIR, 'api');

    describe(relPath, () => {
      const source = readFileSync(routePath, 'utf-8');

      it('checks E2E_TEST_SECRET env var', () => {
        expect(source).toContain('E2E_TEST_SECRET');
      });

      it('validates x-test-secret header', () => {
        expect(source).toContain("'x-test-secret'");
      });

      it('returns 403 when secret is missing or wrong', () => {
        expect(source).toContain('status: 403');
      });

      it('still checks NODE_ENV as defense-in-depth', () => {
        expect(source).toContain('ALLOWED_ENVS');
      });
    });
  }
});
