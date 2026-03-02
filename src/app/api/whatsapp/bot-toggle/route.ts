import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PUT(request: NextRequest) {
  try {
    // 1. Validate session
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse body
    const body = await request.json();
    const enabled = typeof body.enabled === 'boolean' ? body.enabled : null;

    if (enabled === null) {
      return NextResponse.json({ error: 'Invalid request: enabled must be boolean' }, { status: 400 });
    }

    // 3. Update via service role (bypasses RLS for guaranteed consistency)
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('whatsapp_config')
      .update({
        bot_enabled: enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select('bot_enabled')
      .single();

    if (error) {
      console.error('[bot-toggle] Update error:', error);
      return NextResponse.json({ error: 'Failed to update bot status' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 404 });
    }

    console.log(`[bot-toggle] User ${user.id} set bot_enabled=${enabled}`);

    return NextResponse.json({ success: true, enabled: data.bot_enabled });
  } catch (error) {
    console.error('[bot-toggle] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
