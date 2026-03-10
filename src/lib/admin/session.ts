import { createHmac, randomUUID } from 'crypto';
import Redis from 'ioredis';
import { parseRedisUrl } from '@/lib/redis/parse-url';
import { logger } from '@/lib/logger';

const SESSION_EXPIRY_HOURS = 8;
const SESSION_EXPIRY_SECONDS = SESSION_EXPIRY_HOURS * 60 * 60;

let warnedPasswordFallback = false;

/**
 * Returns the HMAC signing secret for admin session tokens.
 * Prefers ADMIN_SESSION_SECRET (dedicated); falls back to ADMIN_PASSWORD.
 */
function getSigningSecret(): string | undefined {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (secret && !process.env.ADMIN_SESSION_SECRET && !warnedPasswordFallback) {
    logger.warn('[admin/session] Using password fallback for session signing — set ADMIN_SESSION_SECRET for better security');
    warnedPasswordFallback = true;
  }
  return secret;
}

// ─── Redis / In-Memory Session Store ─────────────────────────────────────────

const REDIS_URL = process.env.STORAGE_URL || process.env.REDIS_URL;

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!REDIS_URL) return null;
  if (redis) return redis;
  redis = new Redis({
    ...parseRedisUrl(REDIS_URL),
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    commandTimeout: 3000,
    lazyConnect: true,
  });
  return redis;
}

// In-memory fallback for sessions (when Redis unavailable)
const memorySessions = new Map<string, number>(); // sessionId → expiresAt (ms)
const revokedSessions = new Set<string>(); // explicitly revoked sessionIds
let allRevokedAt = 0; // timestamp when revokeAll was called (0 = never)

async function storeSession(sessionId: string): Promise<void> {
  const client = getRedis();
  if (client) {
    try {
      await client.set(`admin_session:${sessionId}`, '1', 'EX', SESSION_EXPIRY_SECONDS);
      return;
    } catch { /* fall through to memory */ }
  }
  memorySessions.set(sessionId, Date.now() + SESSION_EXPIRY_SECONDS * 1000);
}

async function sessionExists(sessionId: string, tokenTimestamp?: number): Promise<boolean> {
  // Check explicit revocation first (in-memory)
  if (revokedSessions.has(sessionId)) return false;
  // Check if all sessions were revoked after this token was created
  if (allRevokedAt > 0 && tokenTimestamp && tokenTimestamp <= allRevokedAt) return false;

  const client = getRedis();
  if (client) {
    try {
      const val = await client.get(`admin_session:${sessionId}`);
      if (val !== null) return true;
      // Check if explicitly revoked in Redis (deleted key = revoked)
      // If Redis is healthy but key is missing, it may have been:
      // 1. Revoked (deleted) — should reject
      // 2. Stored in another serverless instance's memory — should accept
      // We can't distinguish, so check if we know about this session locally.
      if (memorySessions.has(sessionId)) return false; // We stored it, then Redis lost it — expired
      // Unknown session: fail-secure — reject unknown tokens
      return false;
    } catch { /* Redis error — fall through to memory */ }
  }
  // No Redis available
  const expiresAt = memorySessions.get(sessionId);
  if (expiresAt) {
    if (Date.now() > expiresAt) {
      memorySessions.delete(sessionId);
      return false; // Expired
    }
    return true;
  }
  // Session not found in memory and no Redis — fail-secure: reject unknown tokens
  return false;
}

async function deleteSession(sessionId: string): Promise<void> {
  const client = getRedis();
  if (client) {
    try {
      await client.del(`admin_session:${sessionId}`);
    } catch { /* ignore */ }
  }
  memorySessions.delete(sessionId);
  revokedSessions.add(sessionId);
}

// ─── Token Generation ────────────────────────────────────────────────────────

/**
 * Generates a signed admin session token and stores the session server-side.
 * Format: `${sessionId}.${timestamp}.${signature}`
 */
export async function generateAdminToken(): Promise<{ token: string; expires: Date }> {
  const secret = getSigningSecret();
  if (!secret) throw new Error('ADMIN_SESSION_SECRET (or ADMIN_PASSWORD) not configured');

  const sessionId = randomUUID();
  const timestamp = Date.now().toString();
  const payload = `${sessionId}.${timestamp}`;
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  const token = `${payload}.${signature}`;

  const expires = new Date(Date.now() + SESSION_EXPIRY_SECONDS * 1000);

  // Store session server-side for revocation support
  await storeSession(sessionId);

  return { token, expires };
}

// ─── Token Validation ────────────────────────────────────────────────────────

/**
 * Validates an admin session token.
 * Returns true if:
 * 1. Token has correct format (3 parts)
 * 2. HMAC signature matches
 * 3. Token has not expired (based on embedded timestamp)
 * 4. Session exists server-side (not revoked)
 */
export async function validateAdminToken(token: string | undefined): Promise<boolean> {
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
  if (age > SESSION_EXPIRY_SECONDS * 1000) return false;

  // Check server-side session store (revocation support)
  return sessionExists(sessionId, ts);
}

// ─── Session Revocation ──────────────────────────────────────────────────────

/**
 * Revokes a specific admin session token.
 * Extracts sessionId from the token and removes it from the store.
 */
export async function revokeAdminToken(token: string | undefined): Promise<void> {
  if (!token) return;
  const parts = token.split('.');
  if (parts.length !== 3) return;
  const sessionId = parts[0];
  if (!sessionId) return;
  await deleteSession(sessionId);
}

/**
 * Revokes all active admin sessions.
 * Redis: uses SCAN to find and delete all admin_session:* keys.
 * Memory: clears the in-memory map.
 */
export async function revokeAllAdminSessions(): Promise<void> {
  const client = getRedis();
  if (client) {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', 'admin_session:*', 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await client.del(...keys);
        }
      } while (cursor !== '0');
    } catch { /* ignore */ }
  }
  memorySessions.clear();
  revokedSessions.clear();
  allRevokedAt = Date.now();
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 minutes

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
