import { createHmac, randomUUID } from 'crypto';

const SESSION_EXPIRY_HOURS = 8;

/**
 * Returns the HMAC signing secret for admin session tokens.
 * Prefers ADMIN_SESSION_SECRET (dedicated); falls back to ADMIN_PASSWORD.
 */
function getSigningSecret(): string | undefined {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
}

/**
 * Generates a signed admin session token.
 * Format: `${sessionId}.${timestamp}.${signature}`
 *
 * Self-validating: no server-side storage needed.
 * Each login generates a unique token (randomUUID).
 */
export function generateAdminToken(): { token: string; expires: Date } {
  const secret = getSigningSecret();
  if (!secret) throw new Error('ADMIN_SESSION_SECRET (or ADMIN_PASSWORD) not configured');

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

  const secret = getSigningSecret();
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

import Redis from 'ioredis';

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 minutes

const REDIS_URL = process.env.STORAGE_URL || process.env.REDIS_URL;

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!REDIS_URL) return null;
  if (redis) return redis;
  redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    commandTimeout: 3000,
    lazyConnect: true,
  });
  return redis;
}

// In-memory fallback when Redis is not available
const memoryAttempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimitedMemory(ip: string): boolean {
  const now = Date.now();
  const entry = memoryAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    memoryAttempts.set(ip, { count: 1, resetAt: now + WINDOW_SECONDS * 1000 });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

/**
 * Checks if an IP has exceeded the login rate limit.
 * Uses Redis when available (persists across deploys); falls back to in-memory.
 * Returns true if the request should be BLOCKED.
 */
export async function isRateLimited(ip: string): Promise<boolean> {
  const client = getRedis();
  if (!client) return isRateLimitedMemory(ip);

  try {
    const key = `admin_rate_limit:${ip}`;
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, WINDOW_SECONDS);
    }
    return count > MAX_ATTEMPTS;
  } catch {
    // Redis failure → fall back to in-memory
    return isRateLimitedMemory(ip);
  }
}
