import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateAdminToken } from '@/lib/admin/session';

async function checkAuth() {
  const cookieStore = await cookies();
  return await validateAdminToken(cookieStore.get('admin_session')?.value);
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.GH_PAT_ADMIN || process.env.GH_ACTIONS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'Configure GH_PAT_ADMIN (ou GH_ACTIONS_TOKEN) no env. PAT precisa de project scope.' },
      { status: 500 }
    );
  }

  const projectNodeId = process.env.GH_PROJECT_NODE_ID;
  if (!projectNodeId) {
    return NextResponse.json({ error: 'GH_PROJECT_NODE_ID not configured' }, { status: 500 });
  }

  const body = await req.json();
  const { content_id } = body;

  if (!content_id) {
    return NextResponse.json({ error: 'content_id (issue node_id) is required' }, { status: 400 });
  }

  try {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          mutation($projectId: ID!, $contentId: ID!) {
            addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
              item { id }
            }
          }
        `,
        variables: {
          projectId: projectNodeId,
          contentId: content_id,
        },
      }),
    });

    const data = await res.json();

    if (data.errors) {
      return NextResponse.json({ error: data.errors[0].message }, { status: 500 });
    }

    return NextResponse.json({ item_id: data.data.addProjectV2ItemById.item.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
