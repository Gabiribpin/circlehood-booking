import { describe, it, expect } from 'vitest';
import { normalizePhone, phoneVariants } from '../phone-normalization';

describe('normalizePhone', () => {
  describe('Irish numbers (IE)', () => {
    it('normalizes local format 085...', () => {
      expect(normalizePhone('0851234567')).toBe('+353851234567');
    });

    it('normalizes E.164 with +', () => {
      expect(normalizePhone('+353851234567')).toBe('+353851234567');
    });

    it('normalizes E.164 without +', () => {
      expect(normalizePhone('353851234567')).toBe('+353851234567');
    });

    it('normalizes with spaces', () => {
      expect(normalizePhone('+353 85 123 4567')).toBe('+353851234567');
    });

    it('normalizes with dashes', () => {
      expect(normalizePhone('+353-85-123-4567')).toBe('+353851234567');
    });

    it('normalizes with parentheses', () => {
      expect(normalizePhone('(085) 123 4567')).toBe('+353851234567');
    });

    it('normalizes 083 format', () => {
      expect(normalizePhone('0830326180')).toBe('+353830326180');
    });
  });

  describe('Brazilian numbers (BR)', () => {
    it('normalizes local format with explicit country', () => {
      expect(normalizePhone('11966179803', 'BR')).toBe('+5511966179803');
    });

    it('normalizes E.164 format', () => {
      expect(normalizePhone('+5511966179803')).toBe('+5511966179803');
    });

    it('normalizes without + prefix', () => {
      expect(normalizePhone('5511966179803')).toBe('+5511966179803');
    });
  });

  describe('WhatsApp JID format', () => {
    it('strips @s.whatsapp.net suffix', () => {
      expect(normalizePhone('353851234567@s.whatsapp.net')).toBe('+353851234567');
    });

    it('strips @c.us suffix', () => {
      expect(normalizePhone('353851234567@c.us')).toBe('+353851234567');
    });
  });

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(normalizePhone('')).toBe('');
    });

    it('returns digits with + for unparseable input', () => {
      const result = normalizePhone('12345');
      expect(result).toMatch(/^\+?\d+$/);
    });
  });
});

describe('phoneVariants', () => {
  it('generates E.164, digits-only, and local format for Irish number', () => {
    const variants = phoneVariants('353851234567');
    expect(variants).toContain('+353851234567');
    expect(variants).toContain('353851234567');
    expect(variants).toContain('0851234567');
  });

  it('generates variants from local format', () => {
    const variants = phoneVariants('0851234567');
    expect(variants).toContain('+353851234567');
    expect(variants).toContain('353851234567');
  });

  it('generates variants from WhatsApp JID', () => {
    const variants = phoneVariants('353851234567@s.whatsapp.net');
    expect(variants).toContain('+353851234567');
    expect(variants).toContain('353851234567');
  });

  it('returns empty array for empty input', () => {
    expect(phoneVariants('')).toEqual([]);
  });
});
