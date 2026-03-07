import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateAdminToken } from '@/lib/admin/session';
import { execSync } from 'child_process';

const REPO = 'Gabiribpin/circlehood-booking';

async function checkAuth() {
  const cookieStore = await cookies();
  return await validateAdminToken(cookieStore.get('admin_session')?.value);
}

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

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.GH_PAT_ADMIN || process.env.GH_ACTIONS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'Configure GH_PAT_ADMIN no env.' },
      { status: 500 }
    );
  }

  const body = await req.json();
  const { branch, issueNumber, title } = body;

  if (!branch || !issueNumber || !title) {
    return NextResponse.json(
      { error: 'branch, issueNumber, and title are required' },
      { status: 400 }
    );
  }

  const steps: string[] = [];

  try {
    // 1. Push branch
    try {
      const pushOutput = execSync(`git push -u origin ${branch} 2>&1`, {
        encoding: 'utf-8',
        timeout: 30000,
      });
      steps.push(`Push: ${pushOutput.trim().slice(0, 200)}`);
    } catch (e) {
      const msg = (e as { stderr?: string; stdout?: string }).stderr || (e as Error).message;
      // If branch already pushed, continue
      if (!msg.includes('Everything up-to-date') && !msg.includes('already exists')) {
        throw new Error(`Push failed: ${msg.slice(0, 300)}`);
      }
      steps.push('Push: branch already up-to-date');
    }

    // 2. Create PR via GitHub API
    let prNumber: number;
    let prNodeId: string;
    let prUrl: string;

    try {
      const pr = await ghFetch(`/repos/${REPO}/pulls`, token, {
        method: 'POST',
        body: JSON.stringify({
          title: `fix: ${title} (#${issueNumber})`,
          body: [
            `## O que foi feito`,
            '',
            `Resolve issue #${issueNumber}.`,
            '',
            `Closes #${issueNumber}`,
          ].join('\n'),
          head: branch,
          base: 'main',
        }),
      });
      prNumber = pr.number;
      prNodeId = pr.node_id;
      prUrl = pr.html_url;
      steps.push(`PR #${prNumber} criado: ${prUrl}`);
    } catch (e) {
      const msg = (e as Error).message;
      // If PR already exists, find it
      if (msg.includes('A pull request already exists')) {
        const owner = REPO.split('/')[0];
        const existing = await ghFetch(
          `/repos/${REPO}/pulls?head=${encodeURIComponent(owner + ':' + branch)}&state=open&per_page=1`,
          token
        );
        if (existing && existing.length > 0) {
          prNumber = existing[0].number;
          prNodeId = existing[0].node_id;
          prUrl = existing[0].html_url;
          steps.push(`PR #${prNumber} ja existia: ${prUrl}`);
        } else {
          throw new Error('PR already exists but could not be found');
        }
      } else {
        throw e;
      }
    }

    // 3. Enable auto-merge via GraphQL
    try {
      const gqlRes = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation($prId: ID!) {
              enablePullRequestAutoMerge(input: { pullRequestId: $prId, mergeMethod: SQUASH }) {
                pullRequest { number }
              }
            }
          `,
          variables: { prId: prNodeId },
        }),
      });
      const gqlData = await gqlRes.json();
      if (gqlData.errors) {
        steps.push(`Auto-merge: ${gqlData.errors[0].message}`);
      } else {
        steps.push('Auto-merge ativado');
      }
    } catch {
      steps.push('Auto-merge: falha (nao-critico)');
    }

    return NextResponse.json({
      ok: true,
      prNumber,
      prUrl,
      steps,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, steps },
      { status: 500 }
    );
  }
}
