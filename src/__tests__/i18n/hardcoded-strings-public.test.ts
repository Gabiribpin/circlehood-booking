import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #147: Hardcoded PT-BR strings in public components
 *
 * google-map.tsx and section-gallery.tsx had hardcoded Portuguese strings
 * instead of using useTranslations(). Now all user-facing text uses i18n.
 */

describe('Hardcoded strings removed from public components (issue #147)', () => {
  describe('google-map.tsx', () => {
    const source = readFileSync(resolve('src/components/google-map.tsx'), 'utf-8');

    it('imports useTranslations from next-intl', () => {
      expect(source).toContain("import { useTranslations } from 'next-intl'");
    });

    it('calls useTranslations with public namespace', () => {
      expect(source).toContain("useTranslations('public')");
    });

    it('does not contain hardcoded "Carregando mapa..."', () => {
      expect(source).not.toContain("'Carregando mapa...'");
      expect(source).not.toContain('"Carregando mapa..."');
    });

    it('does not contain hardcoded "Falha ao carregar Google Maps"', () => {
      expect(source).not.toContain("'Falha ao carregar Google Maps'");
    });

    it('does not contain hardcoded "Como Chegar"', () => {
      expect(source).not.toContain('>Como Chegar<');
      expect(source).not.toContain('Como Chegar\n');
    });

    it('uses t() for map load error', () => {
      expect(source).toContain("t('mapLoadError')");
    });

    it('uses t() for loading map text', () => {
      expect(source).toContain("t('loadingMap')");
    });

    it('uses t() for get directions button', () => {
      expect(source).toContain("t('getDirections')");
    });
  });

  describe('section-gallery.tsx', () => {
    const source = readFileSync(
      resolve('src/components/public-page/section-gallery.tsx'),
      'utf-8',
    );

    it('imports useTranslations from next-intl', () => {
      expect(source).toContain("useTranslations");
    });

    it('calls useTranslations with public namespace', () => {
      expect(source).toContain("useTranslations('public')");
    });

    it('does not contain hardcoded "Carregando galeria..."', () => {
      expect(source).not.toContain("'Carregando galeria...'");
      expect(source).not.toContain('"Carregando galeria..."');
    });

    it('does not contain hardcoded "Todos" button text', () => {
      // Should not have raw "Todos" as button content
      const lines = source.split('\n');
      for (const line of lines) {
        if (line.trim() === 'Todos') {
          expect.fail('Found hardcoded "Todos" button text');
        }
      }
    });

    it('uses t() for loading gallery text', () => {
      expect(source).toContain("t('loadingGallery')");
    });

    it('uses t() for all categories button', () => {
      expect(source).toContain("t('allCategories')");
    });
  });

  describe('locale files have required keys', () => {
    const locales = ['pt-BR', 'en-US', 'es-ES'];
    const requiredKeys = ['loadingMap', 'mapLoadError', 'getDirections', 'loadingGallery', 'allCategories'];

    for (const locale of locales) {
      describe(locale, () => {
        const messages = JSON.parse(readFileSync(resolve(`messages/${locale}.json`), 'utf-8'));

        for (const key of requiredKeys) {
          it(`has public.${key}`, () => {
            expect(messages.public[key]).toBeDefined();
            expect(messages.public[key].length).toBeGreaterThan(0);
          });
        }
      });
    }
  });
});
