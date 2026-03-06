import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const MARKETING_DIR = path.resolve(__dirname, '../../components/marketing');
const MARKETING_MANAGER = path.resolve(__dirname, '../../app/[locale]/(dashboard)/marketing/marketing-manager.tsx');

const CORRECT_DOMAIN = 'booking.circlehood-tech.com';
const WRONG_DOMAINS = [
  'circlehood-booking.vercel.app',
  'circlehood.app/',
];

describe('Marketing URL correctness', () => {
  const files = [
    'business-card-generator.tsx',
    'social-post-generator.tsx',
    'flyer-generator.tsx',
    'qr-generator.tsx',
  ];

  files.forEach((file) => {
    describe(file, () => {
      const filePath = path.join(MARKETING_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      WRONG_DOMAINS.forEach((wrongDomain) => {
        it(`does not contain wrong domain "${wrongDomain}"`, () => {
          expect(content).not.toContain(wrongDomain);
        });
      });
    });
  });

  describe('marketing-manager.tsx', () => {
    const content = fs.readFileSync(MARKETING_MANAGER, 'utf-8');

    it(`uses correct domain "${CORRECT_DOMAIN}"`, () => {
      expect(content).toContain(CORRECT_DOMAIN);
    });

    WRONG_DOMAINS.forEach((wrongDomain) => {
      it(`does not contain wrong domain "${wrongDomain}"`, () => {
        expect(content).not.toContain(wrongDomain);
      });
    });
  });

  describe('canvas display URLs use correct domain', () => {
    const canvasFiles = [
      'business-card-generator.tsx',
      'social-post-generator.tsx',
      'flyer-generator.tsx',
    ];

    canvasFiles.forEach((file) => {
      it(`${file} canvas URL uses ${CORRECT_DOMAIN}`, () => {
        const filePath = path.join(MARKETING_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        // These files draw URLs on canvas — verify the correct domain is used
        if (content.includes('circlehood')) {
          expect(content).toContain(CORRECT_DOMAIN);
        }
      });
    });
  });
});

describe('Marketing generators use useTranslations', () => {
  const generatorFiles = [
    'business-card-generator.tsx',
    'social-post-generator.tsx',
    'flyer-generator.tsx',
    'qr-generator.tsx',
  ];

  generatorFiles.forEach((file) => {
    it(`${file} imports and uses useTranslations`, () => {
      const filePath = path.join(MARKETING_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain("import { useTranslations } from 'next-intl'");
      expect(content).toContain("useTranslations('marketing')");
    });
  });
});

describe('No hardcoded Portuguese in generator UI', () => {
  const generatorFiles = [
    'business-card-generator.tsx',
    'social-post-generator.tsx',
    'flyer-generator.tsx',
    'qr-generator.tsx',
  ];

  const hardcodedPatterns = [
    // Toast messages
    { pattern: "title: 'Erro'", label: 'hardcoded error toast' },
    { pattern: "title: 'Sucesso'", label: 'hardcoded success toast' },
    { pattern: "'Gerando preview...'", label: 'hardcoded generating text' },
    // Labels
    { pattern: ">Esquema de Cores<", label: 'hardcoded color label' },
    { pattern: ">Personalização<", label: 'hardcoded customization label' },
  ];

  generatorFiles.forEach((file) => {
    const filePath = path.join(MARKETING_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    hardcodedPatterns.forEach(({ pattern, label }) => {
      it(`${file} does not have ${label}: "${pattern}"`, () => {
        expect(content).not.toContain(pattern);
      });
    });
  });
});
