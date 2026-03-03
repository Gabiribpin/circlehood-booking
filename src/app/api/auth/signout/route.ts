import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  // 1. Invalidate session server-side FIRST (while cookies still exist)
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'local' });

  // 2. Explicitly clear Supabase auth cookies with correct path
  //    Supabase SSR uses chunked cookies: sb-<ref>-auth-token, .0, .1, etc.
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  for (const cookie of allCookies) {
    if (
      cookie.name.startsWith('sb-') ||
      cookie.name.includes('supabase')
    ) {
      cookieStore.delete({ name: cookie.name, path: '/' });
    }
  }

  const url = new URL('/login', request.url);
  // Use 303 to force GET method on redirect (prevents 405 on /login)
  return NextResponse.redirect(url, 303);
}

export async function GET(request: Request) {
  // Support GET method too for direct access
  return POST(request);
}
