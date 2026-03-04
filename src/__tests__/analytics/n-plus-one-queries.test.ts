import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #146: N+1 queries in analytics endpoints
 *
 * All analytics routes were making 2 separate queries (bookings + services).
 * Now they use Supabase JOINs via select('..., services(price)') to fetch
 * everything in a single query.
 */

const routes = [
  {
    name: 'clients',
    path: 'src/app/api/analytics/clients/route.ts',
  },
  {
    name: 'revenue',
    path: 'src/app/api/analytics/revenue/route.ts',
  },
  {
    name: 'overview',
    path: 'src/app/api/analytics/overview/route.ts',
  },
  {
    name: 'services/ranking',
    path: 'src/app/api/analytics/services/ranking/route.ts',
  },
];

describe('N+1 query elimination in analytics endpoints (issue #146)', () => {
  for (const route of routes) {
    describe(`${route.name} route`, () => {
      const source = readFileSync(resolve(route.path), 'utf-8');

      it('uses JOIN syntax services(...) in the select', () => {
        expect(source).toContain('services(');
      });

      it('does NOT have a separate .from("services") query', () => {
        // The only .from() call should be for 'bookings' (or 'professionals')
        // There should NOT be a separate .from('services') query
        const fromServicesCalls = (source.match(/\.from\(['"]services['"]\)/g) || []).length;
        expect(fromServicesCalls).toBe(0);
      });

      it('does NOT use .in("id", serviceIds) pattern', () => {
        expect(source).not.toContain("'id', serviceIds");
      });

      it('does NOT build a priceMap from a second query', () => {
        expect(source).not.toContain('priceMap');
      });

      it('has only one .from("bookings") call', () => {
        const fromBookingsCalls = (source.match(/\.from\(['"]bookings['"]\)/g) || []).length;
        expect(fromBookingsCalls).toBe(1);
      });
    });
  }
});
