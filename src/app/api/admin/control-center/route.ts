import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateAdminToken } from '@/lib/admin/session';

export async function GET() {
  const cookieStore = await cookies();
  if (!validateAdminToken(cookieStore.get('admin_session')?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('control_center_entries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  if (!validateAdminToken(cookieStore.get('admin_session')?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { type, title, form_data, checklist } = body;

  if (!type || !title?.trim() || !form_data || !checklist) {
    return NextResponse.json(
      { error: 'type, title, form_data e checklist são obrigatórios' },
      { status: 400 }
    );
  }

  if (type !== 'idea' && type !== 'error') {
    return NextResponse.json({ error: 'type deve ser "idea" ou "error"' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('control_center_entries')
    .insert({ type, title: title.trim(), form_data, checklist } as never)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
