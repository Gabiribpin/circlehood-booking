import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      // Check if user already has a professional record
      const admin = createAdminClient();
      const { data: professional } = await admin
        .from('professionals')
        .select('id')
        .eq('user_id', data.session.user.id)
        .maybeSingle();

      if (professional) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      // OAuth user without professional record → complete profile
      return NextResponse.redirect(`${origin}/complete-profile`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
