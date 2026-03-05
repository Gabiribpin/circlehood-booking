import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const LOCALES = ['pt-BR', 'en-US', 'es-ES'];

function loadMessages(locale: string) {
  const filePath = path.resolve(__dirname, `../../../messages/${locale}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

describe('Marketing i18n translations', () => {
  const allMessages: Record<string, any> = {};

  LOCALES.forEach((locale) => {
    allMessages[locale] = loadMessages(locale);
  });

  it('all locale files are valid JSON', () => {
    LOCALES.forEach((locale) => {
      expect(allMessages[locale]).toBeDefined();
      expect(typeof allMessages[locale]).toBe('object');
    });
  });

  it('marketing namespace exists in all locales', () => {
    LOCALES.forEach((locale) => {
      expect(allMessages[locale].marketing).toBeDefined();
      expect(typeof allMessages[locale].marketing).toBe('object');
    });
  });

  describe('QR generator keys', () => {
    const qrKeys = [
      'generatingPreview', 'qrSizeLabel', 'qrColorLabel', 'qrCustomColor',
      'qrDownloadPNG', 'qrDownloadSVG', 'qrSaveDesign', 'qrSaveName',
      'qrSaveNamePlaceholder', 'qrSaveHint',
    ];

    qrKeys.forEach((key) => {
      it(`key "${key}" exists in all locales`, () => {
        LOCALES.forEach((locale) => {
          expect(allMessages[locale].marketing[key]).toBeDefined();
          expect(allMessages[locale].marketing[key]).not.toBe('');
        });
      });
    });
  });

  describe('Business card generator keys', () => {
    const cardKeys = [
      'cardBackgroundLabel', 'cardPhoneLabel', 'cardInstagramLabel',
      'cardUpdatePreview', 'cardDownload', 'cardResolution',
    ];

    cardKeys.forEach((key) => {
      it(`key "${key}" exists in all locales`, () => {
        LOCALES.forEach((locale) => {
          expect(allMessages[locale].marketing[key]).toBeDefined();
          expect(allMessages[locale].marketing[key]).not.toBe('');
        });
      });
    });
  });

  describe('Social post generator keys', () => {
    const socialKeys = [
      'socialFormatLabel', 'socialTitleLabel', 'socialMessageLabel', 'socialDownload',
    ];

    socialKeys.forEach((key) => {
      it(`key "${key}" exists in all locales`, () => {
        LOCALES.forEach((locale) => {
          expect(allMessages[locale].marketing[key]).toBeDefined();
          expect(allMessages[locale].marketing[key]).not.toBe('');
        });
      });
    });
  });

  describe('Flyer generator keys', () => {
    const flyerKeys = [
      'flyerSizeLabel', 'flyerColorLabel', 'flyerPhoneLabel',
      'flyerDownload', 'flyerPrint',
      'flyerHeadlineLabel', 'flyerHeadlinePlaceholder',
      'flyerDescriptionLabel', 'flyerDescriptionPlaceholder',
      'flyerShowPhoneLabel', 'flyerResolution', 'flyerPrintReady',
      'flyerPrintTipsTitle', 'flyerTip1', 'flyerTip2', 'flyerTip3',
      'flyerTip4', 'flyerTip5', 'flyerCustomize',
      'flyerColorProfessional', 'flyerColorElegant', 'flyerColorFresh',
      'flyerColorVibrant', 'flyerColorModern',
    ];

    flyerKeys.forEach((key) => {
      it(`key "${key}" exists in all locales`, () => {
        LOCALES.forEach((locale) => {
          expect(allMessages[locale].marketing[key]).toBeDefined();
          expect(allMessages[locale].marketing[key]).not.toBe('');
        });
      });
    });
  });

  describe('Toast keys', () => {
    const toastKeys = [
      'toastSuccess', 'toastError', 'toastSaved',
      'toastQrDownloaded', 'toastQrSvgDownloaded', 'toastQrFailed',
      'toastQrDownloadFailed', 'toastQrSaveFailed', 'toastQrSaved',
      'toastCardDownloaded', 'toastCardFailed', 'toastCardDownloadFailed',
      'toastPostDownloaded', 'toastPostFailed', 'toastPostDownloadFailed',
      'toastFlyerDownloaded', 'toastFlyerFailed', 'toastFlyerDownloadFailed',
      'toastPrinting', 'toastPrintOpened', 'toastPrintFailed',
    ];

    toastKeys.forEach((key) => {
      it(`key "${key}" exists in all locales`, () => {
        LOCALES.forEach((locale) => {
          expect(allMessages[locale].marketing[key]).toBeDefined();
          expect(allMessages[locale].marketing[key]).not.toBe('');
        });
      });
    });
  });

  describe('CTA keys', () => {
    const ctaKeys = ['ctaBooking', 'ctaWhatsapp'];

    ctaKeys.forEach((key) => {
      it(`key "${key}" exists in all locales`, () => {
        LOCALES.forEach((locale) => {
          expect(allMessages[locale].marketing[key]).toBeDefined();
          expect(allMessages[locale].marketing[key]).not.toBe('');
        });
      });
    });
  });

  describe('Page-level keys', () => {
    const pageKeys = ['pageTitle', 'pageSubtitle'];

    pageKeys.forEach((key) => {
      it(`key "${key}" exists in all locales`, () => {
        LOCALES.forEach((locale) => {
          expect(allMessages[locale].marketing[key]).toBeDefined();
          expect(allMessages[locale].marketing[key]).not.toBe('');
        });
      });
    });
  });

  it('flyerResolution uses ICU placeholders', () => {
    LOCALES.forEach((locale) => {
      const val = allMessages[locale].marketing.flyerResolution;
      expect(val).toContain('{width}');
      expect(val).toContain('{height}');
    });
  });
});
