import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MESSAGES_DIR = path.resolve(__dirname, '../../../messages');
const LOCALES = ['pt-BR', 'en-US', 'es-ES'] as const;

function loadMessages(locale: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf-8'));
}

const SLUG_NOT_FOUND = path.resolve(
  __dirname,
  '../../app/[locale]/(public)/[slug]/not-found.tsx',
);

const ROOT_NOT_FOUND = path.resolve(
  __dirname,
  '../../app/not-found.tsx',
);

describe('notFound namespace — all locales', () => {
  const EXPECTED_KEYS = ['title', 'professionalNotFound', 'backHome'];

  for (const locale of LOCALES) {
    it(`${locale} has all notFound keys`, () => {
      const messages = loadMessages(locale);
      expect(messages.notFound).toBeDefined();
      for (const key of EXPECTED_KEYS) {
        expect(messages.notFound[key], `Missing notFound.${key} in ${locale}`).toBeDefined();
        expect(typeof messages.notFound[key]).toBe('string');
        expect(messages.notFound[key].length).toBeGreaterThan(0);
      }
    });
  }

  it('all locales have same notFound keys', () => {
    const ptKeys = Object.keys(loadMessages('pt-BR').notFound).sort();
    const enKeys = Object.keys(loadMessages('en-US').notFound).sort();
    const esKeys = Object.keys(loadMessages('es-ES').notFound).sort();
    expect(enKeys).toEqual(ptKeys);
    expect(esKeys).toEqual(ptKeys);
  });
});

describe('[slug]/not-found.tsx — i18n', () => {
  const content = fs.readFileSync(SLUG_NOT_FOUND, 'utf-8');

  it('uses useTranslations', () => {
    expect(content).toContain('useTranslations');
  });

  it('uses notFound namespace', () => {
    expect(content).toContain("useTranslations('notFound')");
  });

  it('does not contain hardcoded PT-BR strings', () => {
    expect(content).not.toContain('Página não encontrada');
    expect(content).not.toContain('Este profissional não existe');
    expect(content).not.toContain('Voltar ao inicio');
  });
});

describe('Root not-found.tsx exists', () => {
  it('file exists at src/app/not-found.tsx', () => {
    expect(fs.existsSync(ROOT_NOT_FOUND)).toBe(true);
  });

  it('renders a 404 page', () => {
    const content = fs.readFileSync(ROOT_NOT_FOUND, 'utf-8');
    expect(content).toContain('404');
    expect(content).toContain('Page not found');
    expect(content).toContain('href="/"');
  });

  it('is a server component (no use client)', () => {
    const content = fs.readFileSync(ROOT_NOT_FOUND, 'utf-8');
    expect(content).not.toContain("'use client'");
  });
});
