import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomBytes } from 'crypto';

// Generate a deterministic test key (32 bytes = 64 hex chars)
const TEST_KEY = randomBytes(32).toString('hex');

describe('token-encryption', () => {
  beforeAll(() => {
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterAll(() => {
    delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  });

  // Dynamic import to pick up env var after setting it
  async function getModule() {
    // Clear module cache to re-evaluate with current env
    const mod = await import('@/lib/integrations/token-encryption');
    return mod;
  }

  it('encryptToken produces output different from input', async () => {
    const { encryptToken } = await getModule();
    const raw = 'IGQVJWZAkFtV3BSZA0NlMF9xN2RlYTBGWXFhc2';
    const encrypted = encryptToken(raw);
    expect(encrypted).not.toBe(raw);
  });

  it('encryptToken output starts with enc: prefix', async () => {
    const { encryptToken } = await getModule();
    const encrypted = encryptToken('some_token_value');
    expect(encrypted.startsWith('enc:')).toBe(true);
  });

  it('encryptToken output has format enc:<iv>:<authTag>:<ciphertext>', async () => {
    const { encryptToken } = await getModule();
    const encrypted = encryptToken('test_token');
    const parts = encrypted.slice(4).split(':'); // remove 'enc:' prefix
    expect(parts).toHaveLength(3);
    // IV = 12 bytes = 24 hex chars
    expect(parts[0]).toHaveLength(24);
    // Auth tag = 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32);
    // Ciphertext length > 0
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it('decryptToken(encryptToken(raw)) === raw (roundtrip)', async () => {
    const { encryptToken, decryptToken } = await getModule();
    const raw = 'ya29.a0AfB_byBZK2VYH-long-google-token-12345';
    expect(decryptToken(encryptToken(raw))).toBe(raw);
  });

  it('decryptToken returns plaintext as-is (legacy backwards compat)', async () => {
    const { decryptToken } = await getModule();
    const legacy = 'IGQVJWZAkFtV3BSZA0NlMF9xN2RlYTBG';
    expect(decryptToken(legacy)).toBe(legacy);
  });

  it('encrypting same token twice produces different ciphertexts (random IV)', async () => {
    const { encryptToken } = await getModule();
    const raw = 'same_token_value';
    const a = encryptToken(raw);
    const b = encryptToken(raw);
    expect(a).not.toBe(b); // different IVs
  });

  it('isEncrypted correctly identifies encrypted vs plaintext', async () => {
    const { encryptToken, isEncrypted } = await getModule();
    expect(isEncrypted('plain_token')).toBe(false);
    expect(isEncrypted(encryptToken('plain_token'))).toBe(true);
  });

  it('decryptToken throws on tampered ciphertext', async () => {
    const { encryptToken, decryptToken } = await getModule();
    const encrypted = encryptToken('secret_token');
    // Flip last hex char to corrupt ciphertext
    const tampered =
      encrypted.slice(0, -1) + (encrypted.at(-1) === 'a' ? 'b' : 'a');
    expect(() => decryptToken(tampered)).toThrow();
  });

  it('throws when OAUTH_TOKEN_ENCRYPTION_KEY is missing', async () => {
    const saved = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
    delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
    try {
      const { encryptToken } = await getModule();
      expect(() => encryptToken('token')).toThrow(
        'OAUTH_TOKEN_ENCRYPTION_KEY',
      );
    } finally {
      process.env.OAUTH_TOKEN_ENCRYPTION_KEY = saved;
    }
  });

  it('handles empty string token', async () => {
    const { encryptToken, decryptToken } = await getModule();
    const encrypted = encryptToken('');
    expect(encrypted.startsWith('enc:')).toBe(true);
    expect(decryptToken(encrypted)).toBe('');
  });

  it('handles unicode characters in token', async () => {
    const { encryptToken, decryptToken } = await getModule();
    const raw = 'token_with_émojis_🔑_and_ñ';
    expect(decryptToken(encryptToken(raw))).toBe(raw);
  });
});

describe('callbacks store encrypted tokens (source verification)', () => {
  const fs = require('fs');
  const path = require('path');

  const instagramCallback = fs.readFileSync(
    path.resolve(
      'src/app/api/integrations/instagram/callback/route.ts',
    ),
    'utf-8',
  );

  const googleCallback = fs.readFileSync(
    path.resolve(
      'src/app/api/integrations/google-calendar/callback/route.ts',
    ),
    'utf-8',
  );

  const instagramPost = fs.readFileSync(
    path.resolve('src/app/api/integrations/instagram/post/route.ts'),
    'utf-8',
  );

  const googleCalendar = fs.readFileSync(
    path.resolve('src/lib/integrations/google-calendar.ts'),
    'utf-8',
  );

  it('Instagram callback encrypts token before saving', () => {
    expect(instagramCallback).toContain('encryptToken(longToken)');
    expect(instagramCallback).toContain(
      "import { encryptToken } from '@/lib/integrations/token-encryption'",
    );
  });

  it('Instagram callback does NOT store plaintext token', () => {
    // Should NOT have `access_token: longToken` (without encryptToken wrapper)
    expect(instagramCallback).not.toMatch(/access_token:\s*longToken[,\s]/);
  });

  it('Google Calendar callback encrypts both tokens before saving', () => {
    expect(googleCallback).toContain('encryptToken(tokens.access_token!)');
    expect(googleCallback).toContain('encryptToken(tokens.refresh_token!)');
  });

  it('Instagram post route decrypts token before use', () => {
    expect(instagramPost).toContain('decryptToken(integration.access_token)');
  });

  it('Google Calendar decrypts tokens when reading from DB', () => {
    expect(googleCalendar).toContain(
      'decryptToken(credentials.access_token)',
    );
    expect(googleCalendar).toContain(
      'decryptToken(credentials.refresh_token)',
    );
  });

  it('Google Calendar encrypts tokens on refresh before saving back', () => {
    expect(googleCalendar).toContain('encryptToken(tokens.access_token)');
    expect(googleCalendar).toContain('encryptToken(tokens.refresh_token)');
  });
});
