import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #182: /api/optimize-route without authentication
 *
 * The route was accepting any professionalId without auth, exposing PII
 * (client names, phones, addresses). Fix: require auth via getUser() +
 * ownership check, remove PII from response.
 */

const routePath = resolve('src/app/api/optimize-route/route.ts');
const source = readFileSync(routePath, 'utf-8');

describe('optimize-route authentication (issue #182)', () => {
  it('uses authenticated Supabase client (not service role)', () => {
    // Must use createClient from @/lib/supabase/server (RLS-aware)
    expect(source).toContain("from '@/lib/supabase/server'");
    // Must NOT use @supabase/supabase-js directly (service role bypass)
    expect(source).not.toContain("from '@supabase/supabase-js'");
  });

  it('calls getUser() for authentication', () => {
    expect(source).toContain('supabase.auth.getUser()');
  });

  it('returns 401 when not authenticated', () => {
    expect(source).toContain("status: 401");
    // Should check for auth error or missing user
    expect(source).toMatch(/if\s*\(\s*authError\s*\|\|\s*!user\s*\)/);
  });

  it('verifies professional ownership via user_id', () => {
    // Must query professionals by user_id, not accept arbitrary professionalId
    expect(source).toContain("eq('user_id', user.id)");
  });

  it('returns 403 when user is not a professional', () => {
    expect(source).toContain("status: 403");
  });

  it('does not accept professionalId from request body', () => {
    // The route should derive professionalId from the authenticated user
    // It should NOT read professionalId from the request body
    const bodyParse = source.slice(source.indexOf('request.json()'));
    expect(bodyParse).not.toContain('professionalId');
  });

  it('uses professional.id from ownership check for all queries', () => {
    // All .eq('professional_id', ...) should use professional.id, not a user-supplied value
    const professionalIdUsages = source.match(/\.eq\('professional_id',\s*([^)]+)\)/g) || [];
    expect(professionalIdUsages.length).toBeGreaterThan(0);
    for (const usage of professionalIdUsages) {
      expect(usage).toContain('professional.id');
    }
  });
});

describe('optimize-route PII protection (issue #182)', () => {
  it('does not select client_name in bookings query', () => {
    // The .from('bookings').select(...) should not include client_name
    const bookingsSection = source.slice(source.indexOf(".from('bookings')"));
    const selectMatch = bookingsSection.match(/\.select\(['"]([^'"]+)['"]\)/);
    expect(selectMatch).not.toBeNull();
    expect(selectMatch![1]).not.toContain('client_name');
  });

  it('does not return client_name or client_phone in response clusters', () => {
    // Cluster interface should not have client_name or client_phone
    const clusterInterface = source.slice(
      source.indexOf('interface Cluster'),
      source.indexOf('}', source.indexOf('interface Cluster')) + 1
    );
    expect(clusterInterface).not.toContain('client_name');
    expect(clusterInterface).not.toContain('client_phone');
  });

  it('does not expose raw bookings with PII in clusters', () => {
    // Clusters should have bookingCount, not raw bookings array
    expect(source).toContain('bookingCount');
    // The Cluster interface should not have a bookings field with PII
    const clusterInterface = source.slice(
      source.indexOf('interface Cluster'),
      source.indexOf('}', source.indexOf('interface Cluster')) + 1
    );
    expect(clusterInterface).not.toContain('bookings:');
  });

  it('Booking interface does not include client_name', () => {
    const bookingInterface = source.slice(
      source.indexOf('interface Booking'),
      source.indexOf('}', source.indexOf('interface Booking')) + 1
    );
    expect(bookingInterface).not.toContain('client_name');
    expect(bookingInterface).not.toContain('client_phone');
  });
});

describe('optimize-route does not use service role key', () => {
  it('does not reference SUPABASE_SERVICE_ROLE_KEY', () => {
    expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('does not import from @supabase/supabase-js', () => {
    expect(source).not.toContain("from '@supabase/supabase-js'");
  });
});
