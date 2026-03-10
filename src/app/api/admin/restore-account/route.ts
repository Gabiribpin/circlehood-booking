import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateAdminToken } from '@/lib/admin/session';
import { z } from 'zod';

const restoreSchema = z.object({
  professional_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  if (!(await validateAdminToken(cookieStore.get('admin_session')?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = restoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid professional_id' }, { status: 400 });
  }
  const { professional_id } = parsed.data;

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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
