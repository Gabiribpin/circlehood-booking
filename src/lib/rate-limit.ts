import Redis from 'ioredis';

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

// In-memory fallback
const memoryStore = new Map<string, { count: number; resetAt: number }>();

function checkMemory(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = memoryStore.get(key);
  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

/**
 * Generic rate limiter using Redis INCR+EXPIRE with in-memory fallback.
 * Returns true if the request should be BLOCKED.
 */
export async function isRateLimited(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const client = getRedis();
  if (!client) return checkMemory(key, limit, windowSeconds * 1000);

  try {
    const redisKey = `rate_limit:${key}`;
    const count = await client.incr(redisKey);
    if (count === 1) {
      await client.expire(redisKey, windowSeconds);
    }
    return count > limit;
  } catch {
    return checkMemory(key, limit, windowSeconds * 1000);
  }
}
