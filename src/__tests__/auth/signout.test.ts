import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockSignOut = vi.fn();
const deletedCookies: Array<{ name: string; path?: string }> = [];

const mockCookies = {
  getAll: vi.fn(() => [
    { name: 'sb-ibkkxykcrwhncvqxzynt-auth-token.0', value: 'chunk0' },
    { name: 'sb-ibkkxykcrwhncvqxzynt-auth-token.1', value: 'chunk1' },
    { name: 'sb-ibkkxykcrwhncvqxzynt-auth-token', value: 'main' },
    { name: 'other-cookie', value: 'keep' },
  ]),
  delete: vi.fn((arg: string | { name: string; path?: string }) => {
    if (typeof arg === 'string') {
      deletedCookies.push({ name: arg });
    } else {
      deletedCookies.push(arg);
    }
  }),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { signOut: mockSignOut },
  })),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookies),
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('signout route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deletedCookies.length = 0;
    mockSignOut.mockResolvedValue({ error: null });
    mockCookies.getAll.mockReturnValue([
      { name: 'sb-ibkkxykcrwhncvqxzynt-auth-token.0', value: 'chunk0' },
      { name: 'sb-ibkkxykcrwhncvqxzynt-auth-token.1', value: 'chunk1' },
      { name: 'sb-ibkkxykcrwhncvqxzynt-auth-token', value: 'main' },
      { name: 'other-cookie', value: 'keep' },
    ]);
    mockCookies.delete.mockImplementation((arg: string | { name: string; path?: string }) => {
      if (typeof arg === 'string') {
        deletedCookies.push({ name: arg });
      } else {
        deletedCookies.push(arg);
      }
    });
  });

  it('calls signOut with scope local BEFORE deleting cookies', async () => {
    const callOrder: string[] = [];
    mockSignOut.mockImplementation(async () => {
      callOrder.push('signOut');
      return { error: null };
    });
    mockCookies.delete.mockImplementation(() => {
      callOrder.push('delete');
    });

    const { POST } = await import('@/app/api/auth/signout/route');
    const request = new Request('https://test.example.com/api/auth/signout', {
      method: 'POST',
    });
    await POST(request);

    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(callOrder[0]).toBe('signOut');
    expect(callOrder.filter(c => c === 'delete').length).toBeGreaterThan(0);
  });

  it('deletes only Supabase cookies (sb-* prefix), not others', async () => {
    const { POST } = await import('@/app/api/auth/signout/route');
    const request = new Request('https://test.example.com/api/auth/signout', {
      method: 'POST',
    });
    await POST(request);

    const deletedNames = deletedCookies.map(c => c.name);
    expect(deletedNames).toContain('sb-ibkkxykcrwhncvqxzynt-auth-token.0');
    expect(deletedNames).toContain('sb-ibkkxykcrwhncvqxzynt-auth-token.1');
    expect(deletedNames).toContain('sb-ibkkxykcrwhncvqxzynt-auth-token');
    expect(deletedNames).not.toContain('other-cookie');
  });

  it('deletes cookies with path=/ to ensure removal', async () => {
    const { POST } = await import('@/app/api/auth/signout/route');
    const request = new Request('https://test.example.com/api/auth/signout', {
      method: 'POST',
    });
    await POST(request);

    for (const deleted of deletedCookies) {
      expect(deleted.path).toBe('/');
    }
  });

  it('redirects to /login with 303 status', async () => {
    const { POST } = await import('@/app/api/auth/signout/route');
    const request = new Request('https://test.example.com/api/auth/signout', {
      method: 'POST',
    });
    const response = await POST(request);

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('/login');
  });

  it('still clears cookies even if signOut fails', async () => {
    mockSignOut.mockResolvedValue({ error: { message: 'session_not_found' } });

    const { POST } = await import('@/app/api/auth/signout/route');
    const request = new Request('https://test.example.com/api/auth/signout', {
      method: 'POST',
    });
    await POST(request);

    expect(deletedCookies.length).toBe(3); // 3 sb-* cookies
  });
});
