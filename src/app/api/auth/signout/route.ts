import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();

    // Clear all cookies
    const cookieStore = await cookies();
    cookieStore.getAll().forEach(cookie => {
      cookieStore.delete(cookie.name);
    });

    const url = new URL('/login', request.url);
    // Use 303 to force GET method on redirect (prevents 405 on /login)
    return NextResponse.redirect(url, 303);
  } catch (err) {
    logger.error('[auth/signout]', err);
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url, 303);
  }
}