import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUpdate = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }));
const mockInsert = vi.fn(() => Promise.resolve({ error: null }));
const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PROF_ID = 'prof-1';
const USER_ID = 'user-1';

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowStr = tomorrow.toISOString().split('T')[0];

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    booking_date: tomorrowStr,
    start_time: '10:00:00',
    client_name: 'Test Client',
    client_phone: '+353800000001',
    client_email: null,
    status: 'confirmed',
    professional_id: PROF_ID,
    service_id: 'svc-1',
    services: { name: 'Corte', price: 50 },
    professionals: { business_name: 'Salão', slug: 'salao', city: 'Dublin', address: 'Rua 1' },
    ...overrides,
  };
}

function setupMocks(bookings: unknown[] = [makeBooking()]) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'bookings') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function () { return this; }),
          ...(function () {
            const chain: Record<string, any> = {};
            chain.eq = vi.fn(() => chain);
            (chain as any).then = (resolve: (v: unknown) => void) =>
              Promise.resolve({ data: bookings, error: null }).then(resolve);
            return chain;
          })(),
        })),
        update: mockUpdate,
      };
    }
    if (table === 'professionals') {
      return {
        select: vi.fn(() => ({
          in: vi.fn(() =>
            Promise.resolve({ data: [{ id: PROF_ID, user_id: USER_ID }], error: null })
          ),
        })),
      };
    }
    if (table === 'whatsapp_config') {
      return {
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            eq: vi.fn(() =>
              Promise.resolve({
                data: [{
                  user_id: USER_ID,
                  provider: 'evolution',
                  evolution_api_url: 'https://evo.test.com',
                  evolution_api_key: 'key',
                  evolution_instance: 'inst',
                  is_active: true,
                }],
                error: null,
              })
            ),
          })),
        })),
      };
    }
    if (table === 'reschedule_tokens') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      };
    }
    // cron_logs, notification_logs
    return { insert: mockInsert };
  });
}

function makeRequest() {
  return new Request('https://test.example.com/api/cron/send-reminders', {
    method: 'POST',
    headers: { authorization: 'Bearer test-cron-secret' },
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('send-reminders cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.CRON_SECRET = 'test-cron-secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('marks reminder_sent=true ONLY when Evolution API returns 200', async () => {
    setupMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('OK', { status: 200 })
    );

    const { POST } = await import('@/app/api/cron/send-reminders/route');
    const response = await POST(makeRequest() as any);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      reminder_sent: true,
      reminder_sent_at: expect.any(String),
    });

    vi.restoreAllMocks();
  });

  it('does NOT mark reminder_sent=true when Evolution API returns 500', async () => {
    setupMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 })
    );

    const { POST } = await import('@/app/api/cron/send-reminders/route');
    const response = await POST(makeRequest() as any);
    const json = await response.json();

    expect(json.success).toBe(true);
    // reminder_sent should NOT have been updated
    expect(mockUpdate).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('does NOT mark reminder_sent=true when fetch throws (network error)', async () => {
    setupMocks();
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('Network timeout')
    );

    const { POST } = await import('@/app/api/cron/send-reminders/route');
    const response = await POST(makeRequest() as any);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('logs failed status in notification_logs when send fails', async () => {
    setupMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Error', { status: 503 })
    );

    const { POST } = await import('@/app/api/cron/send-reminders/route');
    await POST(makeRequest() as any);

    // notification_logs insert should have status 'failed'
    const notifCalls = mockInsert.mock.calls.filter(
      (call) => call[0]?.type === 'reminder' && call[0]?.status === 'failed'
    );
    expect(notifCalls.length).toBe(1);

    vi.restoreAllMocks();
  });
});
