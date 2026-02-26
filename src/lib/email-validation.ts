/**
 * Email validation utilities.
 * Validates format and domain without DNS lookups (fast, synchronous).
 */

// TLDs that are never valid for real email addresses
const INVALID_TLDS = new Set([
  'test', 'invalid', 'localhost', 'local', 'example', 'internal', 'lan', 'home',
]);

// Specific domains known to be invalid / placeholder
const INVALID_DOMAINS = new Set([
  'test.com', 'example.com', 'example.org', 'example.net',
  'invalid.com', 'invalid.org', 'asdf.com', 'qwer.com',
  'tes.com', 'tets.com', 'tset.com', 'gmial.com', 'gmai.com',
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwam.com',
  'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
]);

/** Validates basic email format via RFC 5322-ish regex. */
export function isValidEmailFormat(email: string): boolean {
  const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  return re.test(email);
}

/** Checks that the domain portion is plausible (not a placeholder/test domain). */
export function isValidEmailDomain(email: string): boolean {
  const atIdx = email.lastIndexOf('@');
  if (atIdx === -1) return false;

  const domain = email.slice(atIdx + 1).toLowerCase();

  // Must contain a dot
  if (!domain.includes('.')) return false;

  const parts = domain.split('.');
  const tld = parts[parts.length - 1];

  // TLD must be at least 2 chars
  if (tld.length < 2) return false;

  // Reject known-invalid TLDs
  if (INVALID_TLDS.has(tld)) return false;

  // Reject known-invalid domains
  if (INVALID_DOMAINS.has(domain)) return false;

  // Domain label must not be all numbers (e.g. 123.456 is not a valid domain)
  const domainLabel = parts[parts.length - 2];
  if (/^\d+$/.test(domainLabel)) return false;

  return true;
}

/** Full email validation: format + domain. */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  const normalized = email.trim().toLowerCase();

  if (!isValidEmailFormat(normalized)) {
    return { valid: false, error: 'Formato de email inválido.' };
  }

  if (!isValidEmailDomain(normalized)) {
    return { valid: false, error: 'Domínio do email inválido.' };
  }

  return { valid: true };
}

/** Generates a cryptographically random 64-character hex token. */
export function generateVerificationToken(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Node.js fallback
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('crypto').randomBytes(32).toString('hex');
}
