import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #39: 6 components with hardcoded PT-BR strings
 *
 * Verifies that all components use i18n (useTranslations) instead of
 * hardcoded Portuguese strings, and that translation keys exist in
 * all 3 locales (pt-BR, en-US, es-ES).
 */

const ptBR = JSON.parse(readFileSync(resolve('messages/pt-BR.json'), 'utf-8'));
const enUS = JSON.parse(readFileSync(resolve('messages/en-US.json'), 'utf-8'));
const esES = JSON.parse(readFileSync(resolve('messages/es-ES.json'), 'utf-8'));

// ─── Component code verification ─────────────────────────────────────────────

describe('Hardcoded strings removed (issue #39)', () => {
  const components = [
    {
      name: 'booking-form',
      path: 'src/components/booking/booking-form.tsx',
      namespace: 'public',
      mustNotContain: ['Nome *', 'Seu nome completo', 'Necessário para confirmar', 'Observacoes', 'Alguma informacao'],
      mustContain: ['useTranslations'],
    },
    {
      name: 'time-slots',
      path: 'src/components/booking/time-slots.tsx',
      namespace: 'public',
      mustNotContain: ['Nenhum horario disponível'],
      mustContain: ['useTranslations'],
    },
    {
      name: 'welcome-modal',
      path: 'src/components/onboarding/welcome-modal.tsx',
      namespace: 'whatsapp',
      mustNotContain: ['Importante sobre WhatsApp', 'Entendi, vou usar', 'Proibido (risco'],
      mustContain: ['useTranslations'],
    },
    {
      name: 'qr-code-download',
      path: 'src/components/dashboard/qr-code-download.tsx',
      namespace: 'marketing',
      mustNotContain: ['QR Code da sua página', 'Cole no seu estabelecimento', 'Baixar'],
      mustContain: ['useTranslations'],
    },
    {
      name: 'share-link-card',
      path: 'src/components/dashboard/share-link-card.tsx',
      namespace: 'marketing',
      mustNotContain: ['Compartilhe sua página', 'Seu link:', 'Link copiado', 'Clientes podem escanear', 'Baixar QR Code'],
      mustContain: ['useTranslations'],
    },
    {
      name: 'section-testimonials',
      path: 'src/components/public-page/section-testimonials.tsx',
      namespace: 'testimonials',
      mustNotContain: ['Carregando depoimentos', 'Deixar um depoimento', 'Obrigado! Seu depoimento', 'Enviando...', 'Enviar depoimento'],
      mustContain: ['useTranslations'],
    },
  ];

  for (const comp of components) {
    describe(comp.name, () => {
      const source = readFileSync(resolve(comp.path), 'utf-8');

      it(`uses useTranslations('${comp.namespace}')`, () => {
        for (const pattern of comp.mustContain) {
          expect(source).toContain(pattern);
        }
        expect(source).toContain(`'${comp.namespace}'`);
      });

      for (const str of comp.mustNotContain) {
        it(`does not contain hardcoded "${str}"`, () => {
          expect(source).not.toContain(str);
        });
      }
    });
  }
});

// ─── Translation keys exist in all locales ───────────────────────────────────

describe('Translation keys exist in all locales (issue #39)', () => {
  const requiredKeys: Record<string, string[]> = {
    public: ['nameLabel', 'namePlaceholder', 'emailLabel', 'phoneLabel', 'phonePlaceholder', 'phoneHelp', 'notesLabel', 'notesPlaceholder', 'noSlotsDate'],
    whatsapp: ['welcomeTitle', 'welcomeSubtitle', 'welcomeAllowed', 'welcomeAllowedBot', 'welcomeAllowedBooking', 'welcomeAllowedConfirm', 'welcomeForbidden', 'welcomeForbiddenMass', 'welcomeForbiddenCampaigns', 'welcomeForbiddenReminders', 'welcomeLimit', 'welcomeAccept'],
    marketing: ['qrPageTitle', 'qrPageDesc', 'downloadBtn', 'shareTitle', 'yourLink', 'linkCopied', 'qrCodeLabel', 'scanDesc', 'downloadQR'],
    testimonials: ['loadingPublic', 'leaveTestimonial', 'thankYou', 'formDesc', 'yourNameLabel', 'ratingPublicLabel', 'yourTestimonialLabel', 'testimonialPublicPlaceholder', 'serviceOptionalLabel', 'sending', 'sendTestimonial'],
  };

  for (const [namespace, keys] of Object.entries(requiredKeys)) {
    describe(`${namespace} namespace`, () => {
      for (const key of keys) {
        it(`"${key}" exists in pt-BR`, () => {
          expect(ptBR[namespace][key]).toBeDefined();
          expect(ptBR[namespace][key]).not.toBe('');
        });

        it(`"${key}" exists in en-US`, () => {
          expect(enUS[namespace][key]).toBeDefined();
          expect(enUS[namespace][key]).not.toBe('');
        });

        it(`"${key}" exists in es-ES`, () => {
          expect(esES[namespace][key]).toBeDefined();
          expect(esES[namespace][key]).not.toBe('');
        });
      }
    });
  }
});

// ─── Translations differ between locales ─────────────────────────────────────

describe('Translations are actually translated (issue #39)', () => {
  const spotChecks = [
    { ns: 'public', key: 'nameLabel' },
    { ns: 'public', key: 'phoneHelp' },
    { ns: 'whatsapp', key: 'welcomeTitle' },
    { ns: 'whatsapp', key: 'welcomeAccept' },
    { ns: 'marketing', key: 'shareTitle' },
    { ns: 'marketing', key: 'downloadBtn' },
    { ns: 'testimonials', key: 'leaveTestimonial' },
    { ns: 'testimonials', key: 'thankYou' },
  ];

  for (const { ns, key } of spotChecks) {
    it(`${ns}.${key} differs between pt-BR and en-US`, () => {
      expect(ptBR[ns][key]).not.toBe(enUS[ns][key]);
    });
  }
});
