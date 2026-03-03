import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Valida que o parâmetro `next` é um path relativo seguro.
 * Bloqueia open redirect (ex: //evil.com, https://evil.com, javascript:).
 */
function sanitizeNext(next: string | null): string {
  const fallback = '/dashboard';
  if (!next) return fallback;

  // Deve começar com / e não com // (protocol-relative)
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;

  // Bloquear schemes embutidos (javascript:, data:, etc.)
  if (/^\/.*:/i.test(next) && !next.startsWith('/')) return fallback;

  return next;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = sanitizeNext(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    // PKCE: Supabase valida code_verifier automaticamente via @supabase/ssr
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
