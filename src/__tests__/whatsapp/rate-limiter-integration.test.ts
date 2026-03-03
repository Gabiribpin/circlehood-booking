import { describe, it, expect, beforeEach } from 'vitest';
import { WhatsAppRateLimiter } from '@/lib/whatsapp/rate-limiter';

describe('WhatsAppRateLimiter', () => {
  beforeEach(() => {
    WhatsAppRateLimiter._cleanup();
  });

  it('allows messages below the hourly limit', () => {
    const phone = '+353800000001';
    for (let i = 0; i < 29; i++) {
      const result = WhatsAppRateLimiter.check(phone);
      expect(result.allowed).toBe(true);
      WhatsAppRateLimiter.increment(phone);
    }
    const result = WhatsAppRateLimiter.check(phone);
    expect(result.allowed).toBe(true);
  });

  it('blocks after 30 messages in an hour', () => {
    const phone = '+353800000002';
    for (let i = 0; i < 30; i++) {
      WhatsAppRateLimiter.increment(phone);
    }
    const result = WhatsAppRateLimiter.check(phone);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('hora');
    expect(result.remaining.hour).toBe(0);
  });

  it('blocks after 50 messages in a day', () => {
    const phone = '+353800000003';
    for (let i = 0; i < 50; i++) {
      WhatsAppRateLimiter.increment(phone);
    }
    const result = WhatsAppRateLimiter.check(phone);
    expect(result.allowed).toBe(false);
  });

  it('tracks different phones independently', () => {
    const phone1 = '+353800000004';
    const phone2 = '+353800000005';

    for (let i = 0; i < 30; i++) {
      WhatsAppRateLimiter.increment(phone1);
    }

    expect(WhatsAppRateLimiter.check(phone1).allowed).toBe(false);
    expect(WhatsAppRateLimiter.check(phone2).allowed).toBe(true);
  });

  it('getStats returns correct counts', () => {
    const phone = '+353800000006';
    for (let i = 0; i < 5; i++) {
      WhatsAppRateLimiter.increment(phone);
    }
    const stats = WhatsAppRateLimiter.getStats(phone);
    expect(stats.hour.count).toBe(5);
    expect(stats.hour.remaining).toBe(25);
    expect(stats.day.count).toBe(5);
    expect(stats.day.remaining).toBe(45);
    expect(stats.week.count).toBe(5);
    expect(stats.week.remaining).toBe(195);
  });
});

describe('processor imports rate limiter', () => {
  it('processor.ts source code calls WhatsAppRateLimiter.check', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve('src/lib/whatsapp/processor.ts'),
      'utf-8'
    );
    expect(source).toContain("WhatsAppRateLimiter.check(from)");
    expect(source).toContain("WhatsAppRateLimiter.increment(from)");
    expect(source).toContain("import { WhatsAppRateLimiter }");
  });
});
