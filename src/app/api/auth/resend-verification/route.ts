import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/resend-verification
 * Resends the Supabase Auth confirmation email for the currently logged-in user.
 * Rate-limited by Supabase Auth (max 1 resend per 60s per email by default).
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (user.email_confirmed_at) {
      return NextResponse.json({ error: 'Email já verificado' }, { status: 400 });
    }

    if (!user.email) {
      return NextResponse.json({ error: 'Email não encontrado' }, { status: 400 });
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
    });

    if (error) {
      console.error('[resend-verification] error:', error);
      return NextResponse.json({ error: error.message }, { status: 429 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[resend-verification] unexpected error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
