import { NextRequest, NextResponse } from 'next/server';
import { generateAdminToken, revokeAdminToken, isRateLimited } from '@/lib/admin/session';

export async function POST(request: NextRequest) {
  // Rate limiting by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
      { status: 429 }
    );
  }

  const { password } = await request.json();

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
  }

  const { token, expires } = await generateAdminToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set('admin_session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires,
  });
  return response;
}

export async function DELETE(request: Request) {
  // Revoke session server-side before clearing cookie
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/admin_session=([^;]+)/);
  if (match) {
    await revokeAdminToken(match[1]);
  }

  const url = new URL('/admin-login', request.url);
  const response = NextResponse.redirect(url);
  response.cookies.delete('admin_session');
  return response;
}
