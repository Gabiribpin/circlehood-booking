import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomBytes } from 'crypto';

// Generate deterministic test keys (32 bytes = 64 hex chars)
const TEST_KEY_V1 = randomBytes(32).toString('hex');
const TEST_KEY_V2 = randomBytes(32).toString('hex');

describe('token-encryption', () => {
  beforeAll(() => {
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY = TEST_KEY_V1;
    delete process.env.ENCRYPTION_KEY_VERSION; // default to v1
  });

  afterAll(() => {
    delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY_VERSION;
    delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY_V2;
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

  it('encryptToken output has versioned format enc:v1:<iv>:<authTag>:<ciphertext>', async () => {
    const { encryptToken } = await getModule();
    const encrypted = encryptToken('test_token');
    expect(encrypted.startsWith('enc:v1:')).toBe(true);
    const parts = encrypted.slice('enc:v1:'.length).split(':');
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

  it('decryptToken handles legacy unversioned enc: format as v1', async () => {
    // Manually craft a legacy format token (enc:<iv>:<authTag>:<ciphertext>)
    const { createCipheriv } = await import('crypto');
    const key = Buffer.from(TEST_KEY_V1, 'hex');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update('legacy_test', 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const legacyToken = `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;

    const { decryptToken } = await getModule();
    expect(decryptToken(legacyToken)).toBe('legacy_test');
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

describe('key rotation', () => {
  beforeAll(() => {
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY = TEST_KEY_V1;
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY_V2 = TEST_KEY_V2;
  });

  afterAll(() => {
    delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
    delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY_V2;
    delete process.env.ENCRYPTION_KEY_VERSION;
  });

  async function getModule() {
    const mod = await import('@/lib/integrations/token-encryption');
    return mod;
  }

  it('getCurrentKeyVersion defaults to 1', async () => {
    delete process.env.ENCRYPTION_KEY_VERSION;
    const { getCurrentKeyVersion } = await getModule();
    expect(getCurrentKeyVersion()).toBe(1);
  });

  it('getCurrentKeyVersion reads ENCRYPTION_KEY_VERSION env', async () => {
    process.env.ENCRYPTION_KEY_VERSION = '2';
    const { getCurrentKeyVersion } = await getModule();
    expect(getCurrentKeyVersion()).toBe(2);
    process.env.ENCRYPTION_KEY_VERSION = '1';
  });

  it('getTokenKeyVersion returns 0 for plaintext', async () => {
    const { getTokenKeyVersion } = await getModule();
    expect(getTokenKeyVersion('plain_value')).toBe(0);
  });

  it('getTokenKeyVersion returns version from versioned token', async () => {
    process.env.ENCRYPTION_KEY_VERSION = '1';
    const { encryptToken, getTokenKeyVersion } = await getModule();
    const encrypted = encryptToken('test');
    expect(getTokenKeyVersion(encrypted)).toBe(1);
  });

  it('encrypts with v2 key when ENCRYPTION_KEY_VERSION=2', async () => {
    process.env.ENCRYPTION_KEY_VERSION = '2';
    const { encryptToken, decryptToken } = await getModule();

    const encrypted = encryptToken('secret_data');
    expect(encrypted.startsWith('enc:v2:')).toBe(true);
    expect(decryptToken(encrypted)).toBe('secret_data');
    process.env.ENCRYPTION_KEY_VERSION = '1';
  });

  it('decrypts v1 tokens even when current version is v2', async () => {
    process.env.ENCRYPTION_KEY_VERSION = '1';
    const { encryptToken } = await getModule();
    const v1Token = encryptToken('data_from_v1');

    // Now switch to v2
    process.env.ENCRYPTION_KEY_VERSION = '2';
    const { decryptToken } = await getModule();
    expect(decryptToken(v1Token)).toBe('data_from_v1');
    process.env.ENCRYPTION_KEY_VERSION = '1';
  });

  it('reEncryptToken re-encrypts from v1 to v2', async () => {
    process.env.ENCRYPTION_KEY_VERSION = '1';
    const { encryptToken } = await getModule();
    const v1Token = encryptToken('rotate_me');

    process.env.ENCRYPTION_KEY_VERSION = '2';
    const { reEncryptToken, decryptToken, getTokenKeyVersion } = await getModule();
    const v2Token = reEncryptToken(v1Token);

    expect(v2Token).not.toBeNull();
    expect(v2Token!.startsWith('enc:v2:')).toBe(true);
    expect(getTokenKeyVersion(v2Token!)).toBe(2);
    expect(decryptToken(v2Token!)).toBe('rotate_me');
    process.env.ENCRYPTION_KEY_VERSION = '1';
  });

  it('reEncryptToken returns null if already on current version', async () => {
    process.env.ENCRYPTION_KEY_VERSION = '1';
    const { encryptToken, reEncryptToken } = await getModule();
    const token = encryptToken('no_change');
    expect(reEncryptToken(token)).toBeNull();
  });

  it('needsReEncryption returns true for old version', async () => {
    process.env.ENCRYPTION_KEY_VERSION = '1';
    const { encryptToken } = await getModule();
    const v1Token = encryptToken('check_me');

    process.env.ENCRYPTION_KEY_VERSION = '2';
    const { needsReEncryption } = await getModule();
    expect(needsReEncryption(v1Token)).toBe(true);
    process.env.ENCRYPTION_KEY_VERSION = '1';
  });

  it('needsReEncryption returns false for current version', async () => {
    process.env.ENCRYPTION_KEY_VERSION = '1';
    const { encryptToken, needsReEncryption } = await getModule();
    const token = encryptToken('current');
    expect(needsReEncryption(token)).toBe(false);
  });

  it('needsReEncryption returns false for plaintext', async () => {
    const { needsReEncryption } = await getModule();
    expect(needsReEncryption('plain_value')).toBe(false);
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
