import Redis from 'ioredis';
import { parseRedisUrl } from '@/lib/redis/parse-url';

const EVENT_TTL_SECONDS = 72 * 60 * 60; // 72 hours (Stripe retries up to 3 days)

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

// In-memory fallback when Redis is unavailable
const memoryEvents = new Map<string, number>(); // eventId → expiresAt (ms)

/**
 * Checks if a webhook event has already been processed.
 * Uses Redis when available; falls back to in-memory Map.
 */
export async function isEventProcessed(eventId: string): Promise<boolean> {
  const client = getRedis();
  if (client) {
    try {
      const val = await client.get(`webhook_event:${eventId}`);
      return val !== null;
    } catch { /* fall through to memory */ }
  }

  const expiresAt = memoryEvents.get(eventId);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    memoryEvents.delete(eventId);
    return false;
  }
  return true;
}

/**
 * Marks a webhook event as processed.
 * Stored with TTL so old entries are automatically cleaned up.
 */
export async function markEventProcessed(eventId: string): Promise<void> {
  const client = getRedis();
  if (client) {
    try {
      await client.set(`webhook_event:${eventId}`, '1', 'EX', EVENT_TTL_SECONDS);
      return;
    } catch { /* fall through to memory */ }
  }

  memoryEvents.set(eventId, Date.now() + EVENT_TTL_SECONDS * 1000);
}
