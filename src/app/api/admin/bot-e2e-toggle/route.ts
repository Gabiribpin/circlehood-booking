import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { validateAdminToken } from '@/lib/admin/session';

const REPO = 'Gabiribpin/circlehood-booking';
const VAR_NAME = 'BOT_E2E_ENABLED';

function ghUrl(path: string) {
  return `https://api.github.com/repos/${REPO}/actions/variables${path}`;
}

function ghHeaders(token: string) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function getTokens(): string[] {
  const tokens: string[] = [];
  if (process.env.GH_PAT_ADMIN) tokens.push(process.env.GH_PAT_ADMIN);
  if (process.env.GH_ACTIONS_TOKEN) tokens.push(process.env.GH_ACTIONS_TOKEN);
  if (process.env.GITHUB_TOKEN) tokens.push(process.env.GITHUB_TOKEN);
  return tokens;
}

async function tryFetch(url: string, tokens: string[], opts: RequestInit = {}): Promise<Response> {
  for (const token of tokens) {
    const res = await fetch(url, {
      ...opts,
      headers: { ...ghHeaders(token), ...(opts.headers || {}) },
    });
    if (res.status !== 403) return res;
    // 403 → try next token
  }
  // All tokens returned 403 — return the last 403 response
  return fetch(url, {
    ...opts,
    headers: { ...ghHeaders(tokens[tokens.length - 1]), ...(opts.headers || {}) },
  });
}

export async function GET() {
  const cookieStore = await cookies();
  if (!(await validateAdminToken(cookieStore.get('admin_session')?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tokens = getTokens();
  if (tokens.length === 0) {
    return NextResponse.json({
      enabled: false,
      error: 'Nenhum token configurado. Adicione um GitHub PAT (GH_PAT_ADMIN ou GH_ACTIONS_TOKEN) nas env vars do Vercel.',
    });
  }

  try {
    const res = await tryFetch(ghUrl(`/${VAR_NAME}`), tokens, { cache: 'no-store' });

    if (res.status === 404) {
      return NextResponse.json({ enabled: false });
    }

    if (res.status === 403) {
      return NextResponse.json({
        enabled: false,
        error: 'Nenhum token tem permissao Variables. Configure um PAT com scope "Variables: Read and Write".',
      });
    }

    if (!res.ok) {
      return NextResponse.json({ enabled: false, error: `GitHub ${res.status}` });
    }

    const data = await res.json();
    return NextResponse.json({ enabled: data.value === 'true' });
  } catch (e) {
    return NextResponse.json({ enabled: false, error: (e as Error).message });
  }
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  if (!(await validateAdminToken(cookieStore.get('admin_session')?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Uses GH_PAT_ADMIN → GH_ACTIONS_TOKEN → GITHUB_TOKEN fallback chain
  const tokens = getTokens();
  if (tokens.length === 0) {
    return NextResponse.json({
      error: 'Nenhum token configurado. Adicione um GitHub PAT (GH_PAT_ADMIN ou GH_ACTIONS_TOKEN) nas env vars do Vercel.',
    }, { status: 500 });
  }

  const body = await request.json();
  const newValue = body.enabled ? 'true' : 'false';

  try {
    const res = await tryFetch(ghUrl(`/${VAR_NAME}`), tokens, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: VAR_NAME, value: newValue }),
    });

    if (res.status === 404) {
      // Variable doesn't exist yet — create it
      const createRes = await tryFetch(ghUrl(''), tokens, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: VAR_NAME, value: newValue }),
      });
      if (!createRes.ok) {
        const text = await createRes.text();
        return NextResponse.json({ error: `GitHub ${createRes.status}: ${text}` }, { status: 502 });
      }
    } else if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `GitHub ${res.status}: ${text}` }, { status: 502 });
    }

    return NextResponse.json({ enabled: newValue === 'true' });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
