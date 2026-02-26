import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const adminSession = cookieStore.get('admin_session');
  if (adminSession?.value !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { professional_id } = await request.json();
  if (!professional_id) {
    return NextResponse.json({ error: 'professional_id required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('professionals')
    .update({
      deleted_at: null,
      deletion_scheduled_for: null,
      is_active: true,
    })
    .eq('id', professional_id)
    .not('deleted_at', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
