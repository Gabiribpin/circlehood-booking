import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const LOCALES = ['pt-BR', 'en-US', 'es-ES'] as const;
const MESSAGES_DIR = path.resolve(__dirname, '../../../messages');

function loadMessages(locale: string): Record<string, any> {
  const raw = fs.readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf-8');
  return JSON.parse(raw);
}

function flattenKeys(obj: Record<string, any>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

const allMessages = Object.fromEntries(
  LOCALES.map((loc) => [loc, loadMessages(loc)])
);

const allKeys = Object.fromEntries(
  LOCALES.map((loc) => [loc, new Set(flattenKeys(allMessages[loc]))])
);

describe('i18n: nextSteps namespace', () => {
  const EXPECTED_KEYS = [
    'title', 'subtitle',
    'step1Title', 'step1Badge', 'step1Desc', 'step1Action',
    'step2Title', 'step2Badge', 'step2Desc',
    'downloadQR', 'shareWhatsApp', 'shareMsg', 'scanToBook',
    'step3Title', 'step3Badge', 'step3Desc',
    'shareBotNumber', 'shareBotMsg',
    'botNotConnected', 'configureWhatsApp',
    'whereToShare', 'tip1', 'tip2', 'tip3', 'tip4', 'tip5',
  ];

  for (const locale of LOCALES) {
    it(`${locale} has all nextSteps keys`, () => {
      const ns = allMessages[locale].nextSteps;
      expect(ns).toBeDefined();
      for (const key of EXPECTED_KEYS) {
        expect(ns[key], `Missing nextSteps.${key} in ${locale}`).toBeDefined();
        expect(typeof ns[key]).toBe('string');
        expect(ns[key].length).toBeGreaterThan(0);
      }
    });
  }
});

describe('i18n: pageEditor namespace — section-configurator keys', () => {
  const EXPECTED_KEYS = [
    'configureSection', 'sectionVisible',
    'buttonText', 'bookNowPlaceholder', 'showSocialLinks',
    'titleLabel', 'aboutMePlaceholder',
    'descriptionLabel', 'descriptionPlaceholder', 'yearsExperience',
    'myServicesPlaceholder', 'displayMode', 'displayGrid', 'displayList', 'showPrices',
    'galleryPlaceholder', 'galleryType', 'galleryNormal', 'galleryBeforeAfter',
    'layoutLabel', 'layoutMasonry', 'layoutCarousel',
    'columnsLabel', 'columnsN',
    'beforeImageLabel', 'afterImageLabel',
    'testimonialsPlaceholder', 'maxToShow',
    'contactPlaceholder', 'showPhone', 'showWhatsApp', 'showEmail',
    'faqPlaceholder', 'questionsAnswers', 'addButton', 'noFaqItems',
    'questionN', 'questionPlaceholder', 'answerLabel', 'answerPlaceholder',
    'translateHint', 'saveSection', 'cancelButton',
    'sectionTypeHero', 'sectionTypeAbout', 'sectionTypeServices',
    'sectionTypeGallery', 'sectionTypeTestimonials', 'sectionTypeFaq', 'sectionTypeContact',
  ];

  for (const locale of LOCALES) {
    it(`${locale} has all section-configurator keys in pageEditor`, () => {
      const ns = allMessages[locale].pageEditor;
      expect(ns).toBeDefined();
      for (const key of EXPECTED_KEYS) {
        expect(ns[key], `Missing pageEditor.${key} in ${locale}`).toBeDefined();
        expect(typeof ns[key]).toBe('string');
        expect(ns[key].length).toBeGreaterThan(0);
      }
    });
  }
});

describe('i18n: pageEditor namespace — my-page-editor keys', () => {
  const EXPECTED_KEYS = [
    'publicPage', 'viewLive', 'pageInfo',
    'images', 'profilePhoto', 'coverImage', 'changeCover',
    'bio', 'generateWithAI', 'bioPlaceholder',
    'phoneLabel', 'phonePlaceholder', 'phoneHint',
    'whatsappLabel', 'whatsappPlaceholder', 'whatsappHint',
    'instagramLabel', 'instagramPlaceholder',
    'addressLabel', 'addressPlaceholder',
    'cityLabel', 'cityPlaceholder', 'countryLabel', 'countryPlaceholder',
    'showAddressOnPage', 'saved', 'saveChanges',
    'preview', 'servicesTitle', 'noActiveServices', 'moreServices',
  ];

  for (const locale of LOCALES) {
    it(`${locale} has all my-page-editor keys in pageEditor`, () => {
      const ns = allMessages[locale].pageEditor;
      expect(ns).toBeDefined();
      for (const key of EXPECTED_KEYS) {
        expect(ns[key], `Missing pageEditor.${key} in ${locale}`).toBeDefined();
        expect(typeof ns[key]).toBe('string');
        expect(ns[key].length).toBeGreaterThan(0);
      }
    });
  }
});

describe('i18n: components use useTranslations (no hardcoded PT-BR)', () => {
  const COMPONENTS = [
    {
      name: 'next-steps-card.tsx',
      path: path.resolve(__dirname, '../../components/dashboard/next-steps-card.tsx'),
      hookName: 'nextSteps',
      forbidden: ['Parabéns', 'Baixar QR Code', 'Compartilhar no WhatsApp', 'Onde compartilhar'],
    },
    {
      name: 'section-configurator.tsx',
      path: path.resolve(__dirname, '../../components/page-editor/section-configurator.tsx'),
      hookName: 'pageEditor',
      forbidden: ['Configure os dados', 'Seção Visível', 'Salvar Alterações', 'Perguntas Frequentes'],
    },
    {
      name: 'my-page-editor.tsx',
      path: path.resolve(__dirname, '../../components/dashboard/my-page-editor.tsx'),
      hookName: 'pageEditor',
      forbidden: ['Página Pública', 'Informações da página', 'Foto de perfil', 'Gerar com IA', 'Mostrar endereço'],
    },
  ];

  for (const comp of COMPONENTS) {
    const content = fs.readFileSync(comp.path, 'utf-8');

    it(`${comp.name} imports useTranslations`, () => {
      expect(content).toContain("useTranslations");
    });

    it(`${comp.name} uses namespace '${comp.hookName}'`, () => {
      expect(content).toContain(`useTranslations('${comp.hookName}')`);
    });

    for (const text of comp.forbidden) {
      it(`${comp.name} does not contain hardcoded "${text}"`, () => {
        expect(content).not.toContain(text);
      });
    }
  }
});

describe('i18n: locale parity for new namespaces', () => {
  it('all locales have same keys in nextSteps', () => {
    const ptKeys = Object.keys(allMessages['pt-BR'].nextSteps).sort();
    const enKeys = Object.keys(allMessages['en-US'].nextSteps).sort();
    const esKeys = Object.keys(allMessages['es-ES'].nextSteps).sort();
    expect(enKeys).toEqual(ptKeys);
    expect(esKeys).toEqual(ptKeys);
  });

  it('all locales have same keys in pageEditor', () => {
    const ptKeys = Object.keys(allMessages['pt-BR'].pageEditor).sort();
    const enKeys = Object.keys(allMessages['en-US'].pageEditor).sort();
    const esKeys = Object.keys(allMessages['es-ES'].pageEditor).sort();
    expect(enKeys).toEqual(ptKeys);
    expect(esKeys).toEqual(ptKeys);
  });
});
