import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateAdminToken } from '@/lib/admin/session';
import { createAdminClient } from '@/lib/supabase/admin';

function auth() {
  return async () => {
    const cookieStore = await cookies();
    if (!(await validateAdminToken(cookieStore.get('admin_session')?.value))) {
      return false;
    }
    return true;
  };
}

export async function GET(req: NextRequest) {
  if (!(await auth()())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const type = url.searchParams.get('type');
  const search = url.searchParams.get('search');

  let query = supabase
    .from('admin_inbox_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (type) query = query.eq('type', type);
  if (search) {
    const escaped = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
    query = query.ilike('title', `%${escaped}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!(await auth()())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const body = await req.json();

  const { type, raw_text, title } = body;

  if (!type || !raw_text) {
    return NextResponse.json({ error: 'type and raw_text are required' }, { status: 400 });
  }

  if (!['idea', 'error'].includes(type)) {
    return NextResponse.json({ error: 'type must be idea or error' }, { status: 400 });
  }

  const itemTitle = title || raw_text.slice(0, 80).replace(/\n/g, ' ');

  const { data, error } = await supabase
    .from('admin_inbox_items')
    .insert({
      type,
      raw_text,
      title: itemTitle,
    } as never)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!(await auth()())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const body = await req.json();

  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  // Only allow known fields
  const allowed = ['status', 'severity', 'area', 'needs_info', 'duplicates', 'github_issue_number', 'github_issue_url', 'title'];
  const filtered: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in updates) filtered[key] = updates[key];
  }

  if (Object.keys(filtered).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('admin_inbox_items')
    .update(filtered as never)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json(data);
}
