import { describe, it, expect } from 'vitest';
import {
  getRetryDelay,
  getNextRetryAt,
  isDeadLetter,
  MAX_ATTEMPTS,
  BACKOFF_DELAYS_MS,
} from '@/lib/webhooks/retry-backoff';

describe('getRetryDelay', () => {
  it('returns 1 minute for attempt 0', () => {
    expect(getRetryDelay(0)).toBe(1 * 60 * 1000);
  });

  it('returns 5 minutes for attempt 1', () => {
    expect(getRetryDelay(1)).toBe(5 * 60 * 1000);
  });

  it('returns 30 minutes for attempt 2', () => {
    expect(getRetryDelay(2)).toBe(30 * 60 * 1000);
  });

  it('returns 2 hours for attempt 3', () => {
    expect(getRetryDelay(3)).toBe(2 * 60 * 60 * 1000);
  });

  it('returns 12 hours for attempt 4', () => {
    expect(getRetryDelay(4)).toBe(12 * 60 * 60 * 1000);
  });

  it('returns null for attempt >= MAX_ATTEMPTS', () => {
    expect(getRetryDelay(5)).toBeNull();
    expect(getRetryDelay(10)).toBeNull();
  });

  it('returns null for negative attempt', () => {
    expect(getRetryDelay(-1)).toBeNull();
  });
});

describe('getNextRetryAt', () => {
  it('returns a future date for valid attempts', () => {
    const before = Date.now();
    const result = getNextRetryAt(0);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBeGreaterThanOrEqual(before + BACKOFF_DELAYS_MS[0]);
  });

  it('returns null when max attempts reached', () => {
    expect(getNextRetryAt(MAX_ATTEMPTS)).toBeNull();
  });

  it('each successive attempt has a longer delay', () => {
    const delays = [0, 1, 2, 3, 4].map((i) => {
      const result = getNextRetryAt(i);
      return result!.getTime();
    });

    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });
});

describe('isDeadLetter', () => {
  it('returns false for attempts < MAX_ATTEMPTS', () => {
    expect(isDeadLetter(0)).toBe(false);
    expect(isDeadLetter(4)).toBe(false);
  });

  it('returns true for attempts >= MAX_ATTEMPTS', () => {
    expect(isDeadLetter(5)).toBe(true);
    expect(isDeadLetter(10)).toBe(true);
  });
});

describe('constants', () => {
  it('MAX_ATTEMPTS is 5', () => {
    expect(MAX_ATTEMPTS).toBe(5);
  });

  it('BACKOFF_DELAYS_MS has 5 entries in ascending order', () => {
    expect(BACKOFF_DELAYS_MS).toHaveLength(5);
    for (let i = 1; i < BACKOFF_DELAYS_MS.length; i++) {
      expect(BACKOFF_DELAYS_MS[i]).toBeGreaterThan(BACKOFF_DELAYS_MS[i - 1]);
    }
  });
});
