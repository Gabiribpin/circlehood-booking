import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Clear all cookies
  const cookieStore = await cookies();
  cookieStore.getAll().forEach(cookie => {
    cookieStore.delete(cookie.name);
  });

  const url = new URL('/login', request.url);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  // Support GET method too for direct access
  return POST(request);
}
