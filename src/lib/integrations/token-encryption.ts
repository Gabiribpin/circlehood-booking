import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16;
const PREFIX = 'enc:';

/**
 * Returns the 32-byte encryption key from env var.
 * Throws if not configured — fail loud, not silent.
 */
function getKey(): Buffer {
  const raw = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'OAUTH_TOKEN_ENCRYPTION_KEY env var is required for token encryption',
    );
  }
  // Accept hex (64 chars) or base64 (44 chars) encoded 32-byte key
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error(
      'OAUTH_TOKEN_ENCRYPTION_KEY must be a 32-byte key (64 hex chars or 44 base64 chars)',
    );
  }
  return buf;
}

/**
 * Encrypt a plaintext token → `enc:<iv>:<authTag>:<ciphertext>` (all hex).
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt an `enc:...` string back to plaintext.
 * If the value is NOT prefixed with `enc:`, returns it as-is (legacy plaintext).
 */
export function decryptToken(value: string): string {
  if (!value.startsWith(PREFIX)) {
    // Legacy plaintext token — return as-is for backwards compat during migration
    return value;
  }

  const key = getKey();
  const parts = value.slice(PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Check if a token value is already encrypted.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}
