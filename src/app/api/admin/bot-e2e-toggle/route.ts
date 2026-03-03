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

export async function GET() {
  const cookieStore = await cookies();
  if (!validateAdminToken(cookieStore.get('admin_session')?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.GH_ACTIONS_TOKEN;
  if (!token) {
    return NextResponse.json({ enabled: false, error: 'GH_ACTIONS_TOKEN not configured' });
  }

  try {
    const res = await fetch(ghUrl(`/${VAR_NAME}`), {
      headers: ghHeaders(token),
      cache: 'no-store',
    });

    if (res.status === 404) {
      return NextResponse.json({ enabled: false });
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
  if (!validateAdminToken(cookieStore.get('admin_session')?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.GH_ACTIONS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'GH_ACTIONS_TOKEN not configured' }, { status: 500 });
  }

  const body = await request.json();
  const newValue = body.enabled ? 'true' : 'false';

  try {
    // Try to update existing variable
    const res = await fetch(ghUrl(`/${VAR_NAME}`), {
      method: 'PATCH',
      headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: VAR_NAME, value: newValue }),
    });

    if (res.status === 404) {
      // Variable doesn't exist yet — create it
      const createRes = await fetch(ghUrl(''), {
        method: 'POST',
        headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
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
