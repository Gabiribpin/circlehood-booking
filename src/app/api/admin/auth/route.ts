import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { password } = await request.json();

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
  }

  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const response = NextResponse.json({ ok: true });
  response.cookies.set('admin_session', '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires,
  });
  return response;
}

export async function DELETE(request: Request) {
  const url = new URL('/admin-login', request.url);
  const response = NextResponse.redirect(url);
  response.cookies.delete('admin_session');
  return response;
}
