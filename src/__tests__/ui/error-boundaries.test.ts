import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #149: Missing error boundaries (error.tsx) in dashboard routes
 *
 * Unhandled errors were crashing the entire page. Now error.tsx files
 * provide graceful error UI with retry and navigation options.
 */

describe('Error boundaries in dashboard routes (issue #149)', () => {
  const dashboardErrorPath = resolve('src/app/[locale]/(dashboard)/error.tsx');

  it('dashboard error.tsx exists', () => {
    expect(existsSync(dashboardErrorPath)).toBe(true);
  });

  describe('dashboard error.tsx content', () => {
    const source = readFileSync(dashboardErrorPath, 'utf-8');

    it('is a client component', () => {
      expect(source).toContain("'use client'");
    });

    it('accepts error and reset props', () => {
      expect(source).toContain('error:');
      expect(source).toContain('reset:');
    });

    it('uses useTranslations for i18n', () => {
      expect(source).toContain("useTranslations('common')");
    });

    it('has a retry button that calls reset', () => {
      expect(source).toContain('onClick={reset}');
    });

    it('has a back to dashboard link', () => {
      expect(source).toContain('href="/dashboard"');
    });

    it('logs the error server-side', () => {
      expect(source).toContain('logger.error');
    });

    it('does not expose error details to the user', () => {
      expect(source).not.toContain('error.message');
      expect(source).not.toContain('error.stack');
      expect(source).not.toContain('{error.');
    });
  });

  describe('locale files have error boundary keys', () => {
    const locales = ['pt-BR', 'en-US', 'es-ES'];
    const requiredKeys = ['errorBoundaryTitle', 'errorBoundaryDescription', 'tryAgain', 'backToDashboard'];

    for (const locale of locales) {
      describe(locale, () => {
        const messages = JSON.parse(readFileSync(resolve(`messages/${locale}.json`), 'utf-8'));

        for (const key of requiredKeys) {
          it(`has common.${key}`, () => {
            expect(messages.common[key]).toBeDefined();
            expect(messages.common[key].length).toBeGreaterThan(0);
          });
        }
      });
    }
  });
});
