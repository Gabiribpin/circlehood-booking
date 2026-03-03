import { createHmac, randomUUID } from 'crypto';

const SESSION_EXPIRY_HOURS = 8;

/**
 * Generates a signed admin session token.
 * Format: `${sessionId}.${timestamp}.${signature}`
 *
 * Self-validating: no server-side storage needed.
 * Each login generates a unique token (randomUUID).
 */
export function generateAdminToken(): { token: string; expires: Date } {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error('ADMIN_PASSWORD not configured');

  const sessionId = randomUUID();
  const timestamp = Date.now().toString();
  const payload = `${sessionId}.${timestamp}`;
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  const token = `${payload}.${signature}`;

  const expires = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
  return { token, expires };
}

/**
 * Validates an admin session token.
 * Returns true if:
 * 1. Token has correct format (3 parts)
 * 2. HMAC signature matches
 * 3. Token has not expired (based on embedded timestamp)
 */
export function validateAdminToken(token: string | undefined): boolean {
  if (!token) return false;

  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [sessionId, timestamp, signature] = parts;
  if (!sessionId || !timestamp || !signature) return false;

  // Verify signature
  const payload = `${sessionId}.${timestamp}`;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  // Timing-safe comparison
  if (signature.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (mismatch !== 0) return false;

  // Check expiration
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;
  const age = Date.now() - ts;
  if (age > SESSION_EXPIRY_HOURS * 60 * 60 * 1000) return false;

  return true;
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const attempts = new Map<string, { count: number; resetAt: number }>();

/**
 * Checks if an IP has exceeded the login rate limit.
 * Returns true if the request should be BLOCKED.
 */
export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}
