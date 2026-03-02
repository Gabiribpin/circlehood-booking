import { describe, it, expect, vi, beforeEach } from 'vitest';

// The rate limiter checks process.env at module level.
// We must set env BEFORE importing:
process.env.REDIS_URL = 'redis://test:6379';

// Track pipeline exec calls
const mockPipelineExec = vi.fn();
const mockGet = vi.fn();

// Pipeline methods are chainable
function createPipeline() {
  const p = {
    incr: vi.fn().mockReturnThis(),
    ttl: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: mockPipelineExec,
  };
  return p;
}

vi.mock('ioredis', () => {
  class MockRedis {
    pipeline = vi.fn(() => createPipeline());
    get = mockGet;
    on = vi.fn();
  }
  return { default: MockRedis };
});

// Import AFTER mocks are set up
const { WhatsAppRateLimiter } = await import('../rate-limiter');

describe('WhatsAppRateLimiter (Redis)', () => {
  const profId = 'test-prof-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkAndIncrement()', () => {
    it('allows message when under all limits', async () => {
      mockPipelineExec
        .mockResolvedValueOnce([
          [null, 1], [null, 1], [null, 1],    // INCR results
          [null, -1], [null, -1], [null, -1],  // TTL results (-1 = new)
        ])
        .mockResolvedValueOnce([]);            // TTL set pipeline

      const result = await WhatsAppRateLimiter.checkAndIncrement(profId);
      expect(result.allowed).toBe(true);
      expect(result.remaining.hour).toBe(29);
      expect(result.remaining.day).toBe(49);
      expect(result.remaining.week).toBe(199);
    });

    it('blocks when hourly limit exceeded', async () => {
      mockPipelineExec
        .mockResolvedValueOnce([
          [null, 31], [null, 31], [null, 31],
          [null, 3000], [null, 80000], [null, 500000],
        ])
        .mockResolvedValueOnce([]);

      const result = await WhatsAppRateLimiter.checkAndIncrement(profId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/30/);
      expect(result.remaining.hour).toBe(0);
    });

    it('blocks when daily limit exceeded (hour still under)', async () => {
      mockPipelineExec
        .mockResolvedValueOnce([
          [null, 25], [null, 51], [null, 51],
          [null, 3000], [null, 80000], [null, 500000],
        ])
        .mockResolvedValueOnce([]);

      const result = await WhatsAppRateLimiter.checkAndIncrement(profId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/50/);
    });

    it('fails open when pipeline returns null', async () => {
      mockPipelineExec.mockResolvedValue(null);
      const result = await WhatsAppRateLimiter.checkAndIncrement(profId);
      expect(result.allowed).toBe(true);
      expect(result.remaining.hour).toBe(-1);
    });

    it('fails open when Redis throws', async () => {
      mockPipelineExec.mockRejectedValue(new Error('Redis down'));
      const result = await WhatsAppRateLimiter.checkAndIncrement(profId);
      expect(result.allowed).toBe(true);
    });
  });

  describe('check() (read-only)', () => {
    it('returns counts from Redis GET', async () => {
      mockGet
        .mockResolvedValueOnce('5')
        .mockResolvedValueOnce('10')
        .mockResolvedValueOnce('50');

      const result = await WhatsAppRateLimiter.check(profId);
      expect(result.allowed).toBe(true);
      expect(result.remaining.hour).toBe(25);
      expect(result.remaining.day).toBe(40);
      expect(result.remaining.week).toBe(150);
    });

    it('returns full remaining when keys dont exist', async () => {
      mockGet.mockResolvedValue(null);
      const result = await WhatsAppRateLimiter.check(profId);
      expect(result.allowed).toBe(true);
      expect(result.remaining.hour).toBe(30);
    });
  });

  describe('getStats()', () => {
    it('returns formatted stats', async () => {
      mockGet
        .mockResolvedValueOnce('15')
        .mockResolvedValueOnce('30')
        .mockResolvedValueOnce('100');

      const stats = await WhatsAppRateLimiter.getStats(profId);
      expect(stats.hour).toEqual({ count: 15, limit: 30, remaining: 15 });
      expect(stats.day).toEqual({ count: 30, limit: 50, remaining: 20 });
      expect(stats.week).toEqual({ count: 100, limit: 200, remaining: 100 });
    });
  });
});
