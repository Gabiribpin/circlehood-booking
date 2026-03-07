import type { RedisOptions } from 'ioredis';

/**
 * Parses a Redis connection URL using the WHATWG URL API.
 * Avoids Node.js DEP0169 deprecation warning from ioredis using url.parse().
 */
export function parseRedisUrl(redisUrl: string): RedisOptions {
  const parsed = new URL(redisUrl);
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 6379,
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) || 0 : 0,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}
