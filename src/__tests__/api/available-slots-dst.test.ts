import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #42: DST bug in day-of-week calculation in available-slots
 *
 * The old code used `new Date(date + 'T12:00:00').getDay()` which parses
 * in local time. During DST transitions (e.g., 2026-03-29 in Europe),
 * local-time parsing can shift the date and return the wrong day of week.
 *
 * Fix: `new Date(date + 'T00:00:00Z').getUTCDay()` — always UTC, no DST issues.
 */

describe('available-slots DST fix (issue #42)', () => {
  const source = readFileSync(
    resolve('src/app/api/available-slots/route.ts'),
    'utf-8'
  );

  it('uses UTC parsing (T00:00:00Z) instead of local time (T12:00:00)', () => {
    expect(source).toContain("T00:00:00Z')");
    expect(source).not.toContain("T12:00:00')");
  });

  it('uses getUTCDay() instead of getDay()', () => {
    expect(source).toContain('.getUTCDay()');
    expect(source).not.toContain('.getDay()');
  });
});

// ─── Day-of-week correctness with UTC parsing ────────────────────────────────

describe('UTC day-of-week calculation (issue #42)', () => {
  // Helper matching the fixed code
  function getDayOfWeek(dateStr: string): number {
    return new Date(dateStr + 'T00:00:00Z').getUTCDay();
  }

  it('2026-03-29 (Sunday) — EU DST spring forward', () => {
    // March 29, 2026 is a Sunday (EU clocks spring forward)
    expect(getDayOfWeek('2026-03-29')).toBe(0); // Sunday
  });

  it('2026-03-30 (Monday) — day after EU DST', () => {
    expect(getDayOfWeek('2026-03-30')).toBe(1); // Monday
  });

  it('2026-10-25 (Sunday) — EU DST fall back', () => {
    // October 25, 2026 is a Sunday (EU clocks fall back)
    expect(getDayOfWeek('2026-10-25')).toBe(0); // Sunday
  });

  it('2026-03-08 (Sunday) — US DST spring forward', () => {
    expect(getDayOfWeek('2026-03-08')).toBe(0); // Sunday
  });

  it('2026-11-01 (Sunday) — US DST fall back', () => {
    expect(getDayOfWeek('2026-11-01')).toBe(0); // Sunday
  });

  it('2026-01-01 (Thursday) — no DST, baseline', () => {
    expect(getDayOfWeek('2026-01-01')).toBe(4); // Thursday
  });

  it('2026-12-31 (Thursday) — end of year', () => {
    expect(getDayOfWeek('2026-12-31')).toBe(4); // Thursday
  });

  it('returns correct day for a full week', () => {
    // Week of 2026-03-23 (Mon) to 2026-03-29 (Sun)
    expect(getDayOfWeek('2026-03-23')).toBe(1); // Monday
    expect(getDayOfWeek('2026-03-24')).toBe(2); // Tuesday
    expect(getDayOfWeek('2026-03-25')).toBe(3); // Wednesday
    expect(getDayOfWeek('2026-03-26')).toBe(4); // Thursday
    expect(getDayOfWeek('2026-03-27')).toBe(5); // Friday
    expect(getDayOfWeek('2026-03-28')).toBe(6); // Saturday
    expect(getDayOfWeek('2026-03-29')).toBe(0); // Sunday (DST day)
  });
});
