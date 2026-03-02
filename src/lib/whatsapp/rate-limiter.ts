/**
 * WhatsApp Rate Limiter — Redis-backed
 *
 * Limites por profissional para proteção contra ban:
 *   - 30 mensagens/hora
 *   - 50 mensagens/dia
 *   - 200 mensagens/semana
 *
 * Uses Redis INCR + EXPIRE for atomic, distributed rate limiting.
 * Gracefully falls back to allowing messages if Redis is unavailable.
 */

import Redis from 'ioredis';

const LIMITS = {
  PER_HOUR: 30,
  PER_DAY: 50,
  PER_WEEK: 200,
} as const;

const TTL = {
  HOUR: 3600,
  DAY: 86400,
  WEEK: 604800,
} as const;

// Reuse the same Redis connection strategy as ConversationCache
const REDIS_CONNECTION_URL = process.env.STORAGE_URL || process.env.REDIS_URL;
const isConfigured = !!REDIS_CONNECTION_URL;

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!isConfigured) return null;
  if (redis) return redis;

  redis = new Redis(REDIS_CONNECTION_URL!, {
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    commandTimeout: 3000,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy: (times) => {
      if (times > 1) return null;
      return 500;
    },
  });

  redis.on('error', (err) => {
    if (process.env.NODE_ENV !== 'test') console.error('❌ Redis rate-limiter error:', err.message);
  });
  return redis;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  remaining: {
    hour: number;
    day: number;
    week: number;
  };
}

function bucketKeys(professionalId: string) {
  return {
    hour: `ratelimit:hour:${professionalId}`,
    day: `ratelimit:day:${professionalId}`,
    week: `ratelimit:week:${professionalId}`,
  };
}

export const WhatsAppRateLimiter = {
  /**
   * Check if a message is allowed and increment counters atomically.
   * Uses Redis INCR — each call counts as one message.
   */
  async checkAndIncrement(professionalId: string): Promise<RateLimitResult> {
    const client = getRedis();
    if (!client) {
      // Redis not available — allow (fail-open for availability)
      return { allowed: true, remaining: { hour: -1, day: -1, week: -1 } };
    }

    const keys = bucketKeys(professionalId);

    try {
      // Atomic pipeline: INCR all counters + set TTL if new
      const pipeline = client.pipeline();
      pipeline.incr(keys.hour);
      pipeline.incr(keys.day);
      pipeline.incr(keys.week);
      // TTL only sets if key doesn't have one yet (NX-like via pttl check below)
      pipeline.ttl(keys.hour);
      pipeline.ttl(keys.day);
      pipeline.ttl(keys.week);

      const results = await pipeline.exec();
      if (!results) {
        return { allowed: true, remaining: { hour: -1, day: -1, week: -1 } };
      }

      const hourCount = (results[0]?.[1] as number) ?? 0;
      const dayCount = (results[1]?.[1] as number) ?? 0;
      const weekCount = (results[2]?.[1] as number) ?? 0;
      const hourTTL = (results[3]?.[1] as number) ?? -1;
      const dayTTL = (results[4]?.[1] as number) ?? -1;
      const weekTTL = (results[5]?.[1] as number) ?? -1;

      // Set TTL on first increment (when TTL is -1 = no expiry set)
      const ttlPipeline = client.pipeline();
      if (hourTTL === -1) ttlPipeline.expire(keys.hour, TTL.HOUR);
      if (dayTTL === -1) ttlPipeline.expire(keys.day, TTL.DAY);
      if (weekTTL === -1) ttlPipeline.expire(keys.week, TTL.WEEK);
      await ttlPipeline.exec();

      const remaining = {
        hour: Math.max(0, LIMITS.PER_HOUR - hourCount),
        day: Math.max(0, LIMITS.PER_DAY - dayCount),
        week: Math.max(0, LIMITS.PER_WEEK - weekCount),
      };

      // Check limits (already incremented, so check against limit)
      if (hourCount > LIMITS.PER_HOUR) {
        return {
          allowed: false,
          reason: `Limite de ${LIMITS.PER_HOUR} mensagens por hora atingido. Aguarde antes de enviar mais.`,
          remaining,
        };
      }

      if (dayCount > LIMITS.PER_DAY) {
        return {
          allowed: false,
          reason: `Limite de ${LIMITS.PER_DAY} mensagens por dia atingido. Este limite protege o seu número contra bloqueio.`,
          remaining,
        };
      }

      if (weekCount > LIMITS.PER_WEEK) {
        return {
          allowed: false,
          reason: `Limite de ${LIMITS.PER_WEEK} mensagens por semana atingido.`,
          remaining,
        };
      }

      return { allowed: true, remaining };
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') console.error('❌ Rate limiter Redis error:', (error as Error).message);
      // Fail-open: allow message if Redis has issues
      return { allowed: true, remaining: { hour: -1, day: -1, week: -1 } };
    }
  },

  /**
   * Check rate limit WITHOUT incrementing (for read-only checks / stats).
   */
  async check(professionalId: string): Promise<RateLimitResult> {
    const client = getRedis();
    if (!client) {
      return { allowed: true, remaining: { hour: -1, day: -1, week: -1 } };
    }

    const keys = bucketKeys(professionalId);

    try {
      const [hourStr, dayStr, weekStr] = await Promise.all([
        client.get(keys.hour),
        client.get(keys.day),
        client.get(keys.week),
      ]);

      const hourCount = parseInt(hourStr || '0', 10);
      const dayCount = parseInt(dayStr || '0', 10);
      const weekCount = parseInt(weekStr || '0', 10);

      const remaining = {
        hour: Math.max(0, LIMITS.PER_HOUR - hourCount),
        day: Math.max(0, LIMITS.PER_DAY - dayCount),
        week: Math.max(0, LIMITS.PER_WEEK - weekCount),
      };

      if (hourCount >= LIMITS.PER_HOUR) {
        return { allowed: false, reason: `Limite de ${LIMITS.PER_HOUR} mensagens por hora atingido.`, remaining };
      }
      if (dayCount >= LIMITS.PER_DAY) {
        return { allowed: false, reason: `Limite de ${LIMITS.PER_DAY} mensagens por dia atingido.`, remaining };
      }
      if (weekCount >= LIMITS.PER_WEEK) {
        return { allowed: false, reason: `Limite de ${LIMITS.PER_WEEK} mensagens por semana atingido.`, remaining };
      }

      return { allowed: true, remaining };
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') console.error('❌ Rate limiter check error:', (error as Error).message);
      return { allowed: true, remaining: { hour: -1, day: -1, week: -1 } };
    }
  },

  /**
   * Get rate limit stats for a professional (for UI display).
   */
  async getStats(professionalId: string) {
    const client = getRedis();
    if (!client) {
      return {
        hour: { count: 0, limit: LIMITS.PER_HOUR, remaining: LIMITS.PER_HOUR },
        day: { count: 0, limit: LIMITS.PER_DAY, remaining: LIMITS.PER_DAY },
        week: { count: 0, limit: LIMITS.PER_WEEK, remaining: LIMITS.PER_WEEK },
      };
    }

    const keys = bucketKeys(professionalId);

    try {
      const [hourStr, dayStr, weekStr] = await Promise.all([
        client.get(keys.hour),
        client.get(keys.day),
        client.get(keys.week),
      ]);

      const hourCount = parseInt(hourStr || '0', 10);
      const dayCount = parseInt(dayStr || '0', 10);
      const weekCount = parseInt(weekStr || '0', 10);

      return {
        hour: { count: hourCount, limit: LIMITS.PER_HOUR, remaining: Math.max(0, LIMITS.PER_HOUR - hourCount) },
        day: { count: dayCount, limit: LIMITS.PER_DAY, remaining: Math.max(0, LIMITS.PER_DAY - dayCount) },
        week: { count: weekCount, limit: LIMITS.PER_WEEK, remaining: Math.max(0, LIMITS.PER_WEEK - weekCount) },
      };
    } catch {
      return {
        hour: { count: 0, limit: LIMITS.PER_HOUR, remaining: LIMITS.PER_HOUR },
        day: { count: 0, limit: LIMITS.PER_DAY, remaining: LIMITS.PER_DAY },
        week: { count: 0, limit: LIMITS.PER_WEEK, remaining: LIMITS.PER_WEEK },
      };
    }
  },
};
