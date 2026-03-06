import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Rate limiting: 5 registrations per IP per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde um momento.' },
      { status: 429 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }
  const { email, password, slug, businessName, category, bio, phone, whatsapp, instagram, city, country, currency } = body;

  if (!email || !password || !slug || !businessName) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando.' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message || 'Erro ao criar conta.' },
      { status: 400 }
    );
  }

  // 2. Create professional profile (bypasses RLS with service_role)
  const { error: profileError } = await supabase.from('professionals').insert({
    user_id: authData.user.id,
    slug,
    business_name: businessName,
    category: category || null,
    bio: bio || null,
    phone: phone || null,
    whatsapp: whatsapp || null,
    instagram: instagram || null,
    city: city || 'Dublin',
    country: country || 'IE',
    currency: currency || 'eur',
  });

  if (profileError) {
    // Rollback: delete the auth user if profile creation fails
    await supabase.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json(
      { error: 'Erro ao criar perfil. Tente novamente.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, userId: authData.user.id });
}
