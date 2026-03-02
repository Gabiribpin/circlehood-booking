/**
 * Redis key namespacing por ambiente.
 * Garante isolamento entre production, preview e development
 * quando compartilham a mesma instância Redis.
 */

export function getRedisEnv(): string {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';
}

export function redisKey(key: string): string {
  return `${getRedisEnv()}:${key}`;
}
