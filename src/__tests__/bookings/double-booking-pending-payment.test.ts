import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock('@/lib/validation/booking-schema', () => ({
  bookingSchema: {
    safeParse: vi.fn((data: Record<string, unknown>) => ({
      success: true,
      data: {
        professional_id: data.professional_id,
        service_id: data.service_id,
        booking_date: data.booking_date || '2026-03-10',
        start_time: data.start_time || '10:00',
        client_name: data.client_name || 'Test Client',
        client_phone: data.client_phone || '353800000002',
      },
    })),
  },
  sanitizeString: vi.fn((s: string) => s),
}));

vi.mock('@/lib/resend', () => ({
  sendBookingConfirmationEmail: vi.fn(),
}));

vi.mock('@/lib/whatsapp/evolution', () => ({
  sendEvolutionMessage: vi.fn(),
}));

vi.mock('@/lib/email/safe-send', () => ({
  safeSendEmail: vi.fn(),
}));

vi.mock('@/lib/whatsapp/safe-send', () => ({
  safeSendWhatsApp: vi.fn(),
}));

// ─── Chainable mock builder ─────────────────────────────────────────────────

/**
 * Creates a chainable Supabase-style mock where any method returns itself,
 * except terminal methods which resolve with the provided data.
 */
function chainable(terminals: Record<string, unknown> = {}): Record<string, unknown> {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop in terminals) return terminals[prop];
      // Return a function that returns the same proxy (chainable)
      return vi.fn().mockReturnValue(new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const professional = {
  id: 'prof-1',
  subscription_status: 'active',
  trial_ends_at: '2027-01-01',
};
const service = { id: 'svc-1', name: 'Corte', price: 50, duration_minutes: 30 };

let bookingsCallCount = 0;

function mockSupabase({
  conflictData = [] as { id: string }[],
} = {}) {
  bookingsCallCount = 0;

  mockFrom.mockImplementation((table: string) => {
    if (table === 'professionals') {
      return chainable({
        single: vi.fn().mockResolvedValue({ data: professional, error: null }),
      });
    }
    if (table === 'services') {
      return chainable({
        single: vi.fn().mockResolvedValue({ data: service, error: null }),
      });
    }
    if (table === 'bookings') {
      bookingsCallCount++;
      const callNum = bookingsCallCount;

      // Call 1: idempotency check (select('*')...maybeSingle())
      if (callNum === 1) {
        return chainable({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        });
      }
      // Call 2: expire pending_payment (update...lt())
      if (callNum === 2) {
        return chainable({
          lt: vi.fn().mockResolvedValue({ data: [], error: null }),
        });
      }
      // Call 3: conflict check (select('id')...gt())
      if (callNum === 3) {
        return chainable({
          gt: vi.fn().mockResolvedValue({ data: conflictData, error: null }),
        });
      }
      // Call 4: insert
      return chainable({
        single: vi.fn().mockResolvedValue({
          data: { id: 'new-booking-123' },
          error: null,
        }),
      });
    }
    if (table === 'contacts') {
      return chainable({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      });
    }
    return chainable({});
  });
}

function makeRequest(overrides: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      professional_id: 'prof-1',
      service_id: 'svc-1',
      booking_date: '2026-03-10',
      start_time: '10:00',
      client_name: 'Test Client',
      client_phone: '353800000002',
      ...overrides,
    }),
  }) as unknown as NextRequest;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('Double-booking prevention — pending_payment (#3)', () => {
  it('returns 409 when a pending_payment booking exists in the same slot', async () => {
    mockSupabase({
      conflictData: [{ id: 'pending-payment-booking' }],
    });

    const { POST } = await import('@/app/api/bookings/route');
    const res = await POST(makeRequest());

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('indisponível');
  });

  it('returns 201 when no conflict exists', async () => {
    mockSupabase({ conflictData: [] });

    const { POST } = await import('@/app/api/bookings/route');
    const res = await POST(makeRequest());

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.booking).toBeDefined();
  });

  it('returns 409 when a confirmed booking exists in the same slot', async () => {
    mockSupabase({
      conflictData: [{ id: 'confirmed-booking' }],
    });

    const { POST } = await import('@/app/api/bookings/route');
    const res = await POST(makeRequest());

    expect(res.status).toBe(409);
  });
});

describe('Double-booking — code verification (#3)', () => {
  it('bookings/route.ts uses .in() with both confirmed and pending_payment', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const routePath = join(process.cwd(), 'src/app/api/bookings/route.ts');
    const source = readFileSync(routePath, 'utf-8');

    // Must use .in('status', [...]) not .eq('status', 'confirmed')
    expect(source).toContain(".in('status', ['confirmed', 'pending_payment'])");
    expect(source).not.toMatch(/\.eq\('status',\s*'confirmed'\)/);
  });

  it('checkout/route.ts also checks both statuses', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const routePath = join(process.cwd(), 'src/app/api/bookings/checkout/route.ts');
    const source = readFileSync(routePath, 'utf-8');

    expect(source).toContain(".in('status', ['confirmed', 'pending_payment'])");
  });

  it('chatbot conflict check excludes cancelled/completed (catches pending_payment)', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const chatbotPath = join(process.cwd(), 'src/lib/ai/chatbot.ts');
    const source = readFileSync(chatbotPath, 'utf-8');

    // Chatbot uses .neq('status', 'cancelled').neq('status', 'completed')
    // which naturally includes pending_payment
    expect(source).toContain(".neq('status', 'cancelled')");
    expect(source).toContain(".neq('status', 'completed')");
  });
});
