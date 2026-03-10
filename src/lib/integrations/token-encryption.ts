import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard
const PREFIX = 'enc:';
const VERSIONED_PREFIX = 'enc:v';

/**
 * Returns the current key version number from ENCRYPTION_KEY_VERSION env var.
 * Defaults to 1 if not set.
 */
export function getCurrentKeyVersion(): number {
  return parseInt(process.env.ENCRYPTION_KEY_VERSION ?? '1', 10);
}

/**
 * Returns the 32-byte encryption key for a given version.
 * - Version 1 (default): uses OAUTH_TOKEN_ENCRYPTION_KEY
 * - Version N (N>1): uses OAUTH_TOKEN_ENCRYPTION_KEY_VN
 * Throws if not configured — fail loud, not silent.
 */
function getKeyForVersion(version: number): Buffer {
  const envVar = version === 1
    ? 'OAUTH_TOKEN_ENCRYPTION_KEY'
    : `OAUTH_TOKEN_ENCRYPTION_KEY_V${version}`;
  const raw = process.env[envVar];
  if (!raw) {
    throw new Error(
      `${envVar} env var is required for token encryption (key version ${version})`,
    );
  }
  // Accept hex (64 chars) or base64 (44 chars) encoded 32-byte key
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error(
      `${envVar} must be a 32-byte key (64 hex chars or 44 base64 chars)`,
    );
  }
  return buf;
}

/**
 * Returns the 32-byte encryption key from env var (current version).
 * Throws if not configured — fail loud, not silent.
 */
function getKey(): Buffer {
  return getKeyForVersion(getCurrentKeyVersion());
}

/**
 * Encrypt a plaintext token → `enc:v<version>:<iv>:<authTag>:<ciphertext>` (all hex).
 */
export function encryptToken(plaintext: string): string {
  const version = getCurrentKeyVersion();
  const key = getKeyForVersion(version);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}v${version}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Parse an encrypted token string to extract version and components.
 */
function parseEncrypted(value: string): { version: number; iv: Buffer; authTag: Buffer; ciphertext: Buffer } {
  const afterPrefix = value.slice(PREFIX.length);

  // Versioned format: enc:v<N>:<iv>:<authTag>:<ciphertext>
  if (afterPrefix.startsWith('v')) {
    const parts = afterPrefix.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid versioned encrypted token format');
    }
    const version = parseInt(parts[0].slice(1), 10);
    if (isNaN(version) || version < 1) {
      throw new Error('Invalid encryption key version');
    }
    return {
      version,
      iv: Buffer.from(parts[1], 'hex'),
      authTag: Buffer.from(parts[2], 'hex'),
      ciphertext: Buffer.from(parts[3], 'hex'),
    };
  }

  // Legacy unversioned format: enc:<iv>:<authTag>:<ciphertext> — treated as v1
  const parts = afterPrefix.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }
  return {
    version: 1,
    iv: Buffer.from(parts[0], 'hex'),
    authTag: Buffer.from(parts[1], 'hex'),
    ciphertext: Buffer.from(parts[2], 'hex'),
  };
}

/**
 * Decrypt an `enc:...` string back to plaintext.
 * Supports both versioned (`enc:v1:...`) and legacy (`enc:...`) formats.
 * If the value is NOT prefixed with `enc:`, returns it as-is (legacy plaintext).
 */
export function decryptToken(value: string): string {
  if (!value.startsWith(PREFIX)) {
    // Legacy plaintext token — return as-is for backwards compat during migration
    return value;
  }

  const { version, iv, authTag, ciphertext } = parseEncrypted(value);
  const key = getKeyForVersion(version);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Get the key version used to encrypt a token.
 * Returns 0 for plaintext (unencrypted) values.
 */
export function getTokenKeyVersion(value: string): number {
  if (!value.startsWith(PREFIX)) return 0;
  const { version } = parseEncrypted(value);
  return version;
}

/**
 * Re-encrypt a token from its current key version to the current active version.
 * Returns null if already on the current version.
 */
export function reEncryptToken(value: string): string | null {
  const currentVersion = getCurrentKeyVersion();
  const tokenVersion = getTokenKeyVersion(value);

  // Already on current version (or plaintext)
  if (tokenVersion === currentVersion) return null;

  // Decrypt with old key, encrypt with new key
  const plaintext = decryptToken(value);
  return encryptToken(plaintext);
}

/**
 * Check if a token value is already encrypted.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

/**
 * Check if a token needs re-encryption (encrypted with an older key version).
 */
export function needsReEncryption(value: string): boolean {
  if (!isEncrypted(value)) return false;
  return getTokenKeyVersion(value) !== getCurrentKeyVersion();
}
