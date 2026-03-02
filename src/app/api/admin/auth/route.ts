import { NextResponse } from 'next/server';

// Emails autorizados como admin (além da senha universal)
const ADMIN_EMAILS = [
  'gabrielaribeiropinheiro@gmail.com',
  'gabriel@circlehoodtech.com',
];

function setAdminCookie(response: NextResponse) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  response.cookies.set('admin_session', '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires,
  });
  return response;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { password, email } = body;

  // Auth by password (existing behavior)
  if (password) {
    if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
    }
    return setAdminCookie(NextResponse.json({ ok: true }));
  }

  // Auth by email (for authorized admin users)
  if (email) {
    const normalizedEmail = email.toLowerCase().trim();
    const envEmails = process.env.ADMIN_EMAILS?.split(',').map((e: string) => e.trim().toLowerCase()) ?? [];
    const allAdminEmails = [...ADMIN_EMAILS.map(e => e.toLowerCase()), ...envEmails];

    if (!allAdminEmails.includes(normalizedEmail)) {
      return NextResponse.json({ error: 'Email não autorizado' }, { status: 403 });
    }
    return setAdminCookie(NextResponse.json({ ok: true }));
  }

  return NextResponse.json({ error: 'Senha ou email obrigatório' }, { status: 400 });
}

export async function DELETE(request: Request) {
  const url = new URL('/admin-login', request.url);
  const response = NextResponse.redirect(url);
  response.cookies.delete('admin_session');
  return response;
}
