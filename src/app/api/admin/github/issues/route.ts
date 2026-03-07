import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateAdminToken } from '@/lib/admin/session';

const REPO = 'Gabiribpin/circlehood-booking';

async function ghFetch(path: string, token: string, opts: RequestInit = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

async function checkAuth() {
  const cookieStore = await cookies();
  return await validateAdminToken(cookieStore.get('admin_session')?.value);
}

export async function GET(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.GH_PAT_ADMIN || process.env.GH_ACTIONS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'Configure GH_PAT_ADMIN (ou GH_ACTIONS_TOKEN) no env. PAT precisa de repo scope.' },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'list';

  try {
    if (action === 'get') {
      const number = url.searchParams.get('number');
      if (!number) {
        return NextResponse.json({ error: 'number parameter required' }, { status: 400 });
      }
      const issue = await ghFetch(`/repos/${REPO}/issues/${number}`, token);
      return NextResponse.json({ body: issue.body || '' });
    }

    if (action === 'search') {
      const q = url.searchParams.get('q') || '';
      if (!q) {
        return NextResponse.json({ error: 'q parameter required for search' }, { status: 400 });
      }
      const data = await ghFetch(
        `/search/issues?q=${encodeURIComponent(q + ` repo:${REPO} is:issue`)}&per_page=20`,
        token
      );
      return NextResponse.json(data.items || []);
    }

    if (action === 'pr-status') {
      const branch = url.searchParams.get('branch');
      if (!branch) {
        return NextResponse.json({ error: 'branch parameter required' }, { status: 400 });
      }

      const owner = REPO.split('/')[0];
      const pulls = await ghFetch(
        `/repos/${REPO}/pulls?head=${encodeURIComponent(owner + ':' + branch)}&state=all&per_page=1`,
        token
      );

      if (!pulls || pulls.length === 0) {
        return NextResponse.json({ hasPR: false, prState: 'none', ciStatus: 'none' });
      }

      const pr = pulls[0];
      const prState: string = pr.merged_at ? 'merged' : pr.state; // 'open' | 'closed' | 'merged'

      let ciStatus = 'none';
      if (pr.head?.sha) {
        try {
          const checks = await ghFetch(
            `/repos/${REPO}/commits/${pr.head.sha}/check-runs?per_page=100`,
            token
          );
          const runs = checks.check_runs || [];
          if (runs.length > 0) {
            const hasFailure = runs.some((r: { conclusion: string | null }) => r.conclusion === 'failure');
            const allSuccess = runs.every((r: { conclusion: string | null; status: string }) =>
              r.conclusion === 'success' || r.conclusion === 'skipped'
            );
            const hasPending = runs.some((r: { status: string }) => r.status !== 'completed');
            if (hasFailure) ciStatus = 'failure';
            else if (hasPending) ciStatus = 'pending';
            else if (allSuccess) ciStatus = 'success';
            else ciStatus = 'pending';
          }
        } catch {
          // If check-runs fails, leave as 'none'
        }
      }

      return NextResponse.json({ hasPR: true, prState, ciStatus });
    }

    if (action === 'open-pr-branches') {
      const pulls = await ghFetch(
        `/repos/${REPO}/pulls?state=open&per_page=100`,
        token
      );
      const branches = (pulls || []).map((p: { head: { ref: string } }) => p.head.ref);
      return NextResponse.json(branches);
    }

    if (action === 'check') {
      await ghFetch(`/repos/${REPO}`, token);
      return NextResponse.json({ connected: true });
    }

    // Default: list open issues
    const data = await ghFetch(
      `/repos/${REPO}/issues?state=open&per_page=100`,
      token
    );
    const issues = data.filter((i: { pull_request?: unknown }) => !i.pull_request);
    return NextResponse.json(issues);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.GH_PAT_ADMIN || process.env.GH_ACTIONS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'Configure GH_PAT_ADMIN (ou GH_ACTIONS_TOKEN) no env. PAT precisa de repo scope.' },
      { status: 500 }
    );
  }

  const body = await req.json();
  const { title, description, labels } = body;

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  try {
    const issueBody = [
      description || '',
      '',
      '---',
      '_Created via Roda V2 (Anti-Caos)_',
    ].join('\n');

    // Comment on existing issue
    if (body.action === 'comment') {
      const { number, comment } = body;
      if (!number || !comment) {
        return NextResponse.json({ error: 'number and comment required' }, { status: 400 });
      }
      await ghFetch(`/repos/${REPO}/issues/${number}/comments`, token, {
        method: 'POST',
        body: JSON.stringify({ body: comment }),
      });
      return NextResponse.json({ ok: true });
    }

    // Create new issue (default)
    const created = await ghFetch(`/repos/${REPO}/issues`, token, {
      method: 'POST',
      body: JSON.stringify({
        title,
        body: issueBody,
        labels: labels || [],
      }),
    });

    return NextResponse.json({
      number: created.number,
      html_url: created.html_url,
      node_id: created.node_id,
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.GH_PAT_ADMIN || process.env.GH_ACTIONS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'Configure GH_PAT_ADMIN (ou GH_ACTIONS_TOKEN) no env.' },
      { status: 500 }
    );
  }

  const body = await req.json();
  const { number, state } = body;

  if (!number) {
    return NextResponse.json({ error: 'number is required' }, { status: 400 });
  }

  try {
    await ghFetch(`/repos/${REPO}/issues/${number}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ state: state || 'closed' }),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
