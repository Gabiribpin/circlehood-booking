import { describe, it, expect, vi } from 'vitest';
import { normalizePhoneForWhatsApp, sendEvolutionMessage } from './evolution';

describe('normalizePhoneForWhatsApp', () => {
  // ─── Casos do enunciado ───────────────────────────────────────────────────

  it('Irlanda: +353 083 032 6180 → 353830326180', () => {
    expect(normalizePhoneForWhatsApp('+353 083 032 6180')).toBe('353830326180');
  });

  it('Brasil: +55 11 96609-8544 → 5511966098544', () => {
    expect(normalizePhoneForWhatsApp('+55 11 96609-8544')).toBe('5511966098544');
  });

  it('UK: +44 07911 123456 → 447911123456', () => {
    expect(normalizePhoneForWhatsApp('+44 07911 123456')).toBe('447911123456');
  });

  it('já correto: 353830326180 → 353830326180 (sem alteração)', () => {
    expect(normalizePhoneForWhatsApp('353830326180')).toBe('353830326180');
  });

  it('Portugal: +351 912 345 678 → 351912345678 (sem trunk prefix)', () => {
    expect(normalizePhoneForWhatsApp('+351 912 345 678')).toBe('351912345678');
  });

  // ─── Casos adicionais ─────────────────────────────────────────────────────

  it('Irlanda com hífens: +353-083-032-6180 → 353830326180', () => {
    expect(normalizePhoneForWhatsApp('+353-083-032-6180')).toBe('353830326180');
  });

  it('Irlanda sem +: 353083032618 → 35383032618', () => {
    expect(normalizePhoneForWhatsApp('353083032618')).toBe('35383032618');
  });

  it('Brasil com trunk raro: +55 011 96609-8544 → 5511966098544', () => {
    expect(normalizePhoneForWhatsApp('+55 011 96609-8544')).toBe('5511966098544');
  });

  it('Brasil sem 0: +55 11 96609-8544 permanece 5511966098544', () => {
    expect(normalizePhoneForWhatsApp('+55 11 96609-8544')).toBe('5511966098544');
  });

  it('Alemanha: +49 0171 1234567 → 491711234567', () => {
    expect(normalizePhoneForWhatsApp('+49 0171 1234567')).toBe('491711234567');
  });

  it('França: +33 06 12 34 56 78 → 33612345678', () => {
    expect(normalizePhoneForWhatsApp('+33 06 12 34 56 78')).toBe('33612345678');
  });

  it('número já normalizado sem prefixo: 5511966098544 → 5511966098544', () => {
    expect(normalizePhoneForWhatsApp('5511966098544')).toBe('5511966098544');
  });

  it('número com parênteses: (353) 083-032-6180 → 353830326180', () => {
    expect(normalizePhoneForWhatsApp('(353) 083-032-6180')).toBe('353830326180');
  });

  it('número vazio → string vazia', () => {
    expect(normalizePhoneForWhatsApp('')).toBe('');
  });

  it('só símbolos → string vazia', () => {
    expect(normalizePhoneForWhatsApp('+-() ')).toBe('');
  });
});

describe('sendEvolutionMessage error sanitization', () => {
  it('does NOT leak response body in thrown error message', async () => {
    const sensitiveBody = 'Invalid API key: sk_live_secret123_leaked';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(sensitiveBody, { status: 401 })
    );

    const config = {
      apiUrl: 'https://evo.example.com',
      apiKey: 'secret-key-value',
      instance: 'test-instance',
    };

    try {
      await sendEvolutionMessage('+353800000000', 'test', config);
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.message).toBe('Evolution API error: 401');
      expect(err.message).not.toContain('sk_live_secret123');
      expect(err.message).not.toContain('Invalid API key');
    }

    vi.restoreAllMocks();
  });

  it('error message contains only status code, no body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{"error":"Unauthorized","apikey":"abc123"}', { status: 403 })
    );

    const config = {
      apiUrl: 'https://evo.example.com',
      apiKey: 'abc123',
      instance: 'test',
    };

    try {
      await sendEvolutionMessage('+353800000001', 'test', config);
    } catch (err: any) {
      expect(err.message).toBe('Evolution API error: 403');
      expect(err.message).not.toContain('abc123');
      expect(err.message).not.toContain('Unauthorized');
    }

    vi.restoreAllMocks();
  });
});
