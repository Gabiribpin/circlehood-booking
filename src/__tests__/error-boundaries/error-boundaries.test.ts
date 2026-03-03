import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const LAYOUT_GROUPS = ['(dashboard)', '(auth)', '(public)', '(admin)'] as const;

const getErrorFilePath = (group: string) =>
  join(process.cwd(), 'src/app/[locale]', group, 'error.tsx');

describe('Error boundaries — all layout groups (#29)', () => {
  for (const group of LAYOUT_GROUPS) {
    describe(group, () => {
      const filePath = getErrorFilePath(group);

      it(`${group}/error.tsx exists`, () => {
        expect(existsSync(filePath)).toBe(true);
      });

      it(`${group}/error.tsx is a client component`, () => {
        const content = readFileSync(filePath, 'utf-8');
        expect(content.startsWith("'use client'")).toBe(true);
      });

      it(`${group}/error.tsx exports default function`, () => {
        const content = readFileSync(filePath, 'utf-8');
        expect(content).toMatch(/export default function \w+Error/);
      });

      it(`${group}/error.tsx accepts error and reset props`, () => {
        const content = readFileSync(filePath, 'utf-8');
        expect(content).toContain('error: Error');
        expect(content).toContain('reset: () => void');
      });

      it(`${group}/error.tsx calls reset on button click`, () => {
        const content = readFileSync(filePath, 'utf-8');
        expect(content).toContain('onClick={reset}');
      });

      it(`${group}/error.tsx uses i18n translations`, () => {
        const content = readFileSync(filePath, 'utf-8');
        expect(content).toContain("useTranslations('common')");
        expect(content).toContain("t('errorBoundaryTitle')");
        expect(content).toContain("t('errorBoundaryDescription')");
        expect(content).toContain("t('tryAgain')");
      });

      it(`${group}/error.tsx logs error to console`, () => {
        const content = readFileSync(filePath, 'utf-8');
        expect(content).toContain('console.error');
      });
    });
  }
});

describe('Error boundary i18n keys exist in all locales', () => {
  const LOCALES = ['pt-BR', 'en-US', 'es-ES'] as const;
  const REQUIRED_KEYS = [
    'errorBoundaryTitle',
    'errorBoundaryDescription',
    'tryAgain',
  ] as const;

  for (const locale of LOCALES) {
    it(`${locale} has all error boundary translation keys`, () => {
      const messagesPath = join(process.cwd(), 'messages', `${locale}.json`);
      const messages = JSON.parse(readFileSync(messagesPath, 'utf-8'));

      for (const key of REQUIRED_KEYS) {
        expect(messages.common[key]).toBeDefined();
        expect(typeof messages.common[key]).toBe('string');
        expect(messages.common[key].length).toBeGreaterThan(0);
      }
    });
  }
});
