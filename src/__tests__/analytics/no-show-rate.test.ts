import { describe, it, expect } from 'vitest';
import { computeNoShowMetrics } from '@/lib/analytics/no-show-rate';

describe('computeNoShowMetrics', () => {
  it('returns zeros for empty array', () => {
    const result = computeNoShowMetrics([]);
    expect(result).toEqual({ noShows: 0, total: 0, rate: 0 });
  });

  it('calculates rate for mixed statuses', () => {
    const bookings = [
      { status: 'confirmed' },
      { status: 'completed' },
      { status: 'no_show' },
      { status: 'cancelled' },
      { status: 'no_show' },
    ];
    const result = computeNoShowMetrics(bookings);
    expect(result.noShows).toBe(2);
    expect(result.total).toBe(5);
    expect(result.rate).toBe(40);
  });

  it('returns 100% when all are no-shows', () => {
    const bookings = [{ status: 'no_show' }, { status: 'no_show' }];
    const result = computeNoShowMetrics(bookings);
    expect(result).toEqual({ noShows: 2, total: 2, rate: 100 });
  });

  it('returns 0% when no no-shows exist', () => {
    const bookings = [{ status: 'confirmed' }, { status: 'completed' }];
    const result = computeNoShowMetrics(bookings);
    expect(result).toEqual({ noShows: 0, total: 2, rate: 0 });
  });

  it('handles single no-show booking', () => {
    const result = computeNoShowMetrics([{ status: 'no_show' }]);
    expect(result).toEqual({ noShows: 1, total: 1, rate: 100 });
  });
});
