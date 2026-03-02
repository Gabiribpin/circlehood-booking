import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('redis/prefix', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.VERCEL_ENV;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.env as any).NODE_ENV = undefined;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('getRedisEnv', () => {
    it('retorna VERCEL_ENV quando definido', async () => {
      process.env.VERCEL_ENV = 'preview';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.env as any).NODE_ENV = 'production';
      const { getRedisEnv } = await import('../prefix');
      expect(getRedisEnv()).toBe('preview');
    });

    it('faz fallback para NODE_ENV quando VERCEL_ENV ausente', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.env as any).NODE_ENV = 'test';
      const { getRedisEnv } = await import('../prefix');
      expect(getRedisEnv()).toBe('test');
    });

    it('retorna "development" quando nenhum env está definido', async () => {
      const { getRedisEnv } = await import('../prefix');
      expect(getRedisEnv()).toBe('development');
    });
  });

  describe('redisKey', () => {
    it('prefixa a key com o ambiente', async () => {
      process.env.VERCEL_ENV = 'production';
      const { redisKey } = await import('../prefix');
      expect(redisKey('conversation:abc')).toBe('production:conversation:abc');
    });

    it('prefixa com NODE_ENV fallback', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.env as any).NODE_ENV = 'test';
      const { redisKey } = await import('../prefix');
      expect(redisKey('greeting_lock:xyz')).toBe('test:greeting_lock:xyz');
    });

    it('prefixa com "development" como default', async () => {
      const { redisKey } = await import('../prefix');
      expect(redisKey('some:key')).toBe('development:some:key');
    });
  });
});
