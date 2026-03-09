import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRateLimited } from '@/lib/rate-limit';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  slug: z.string().min(1),
  businessName: z.string().min(1),
  category: z.string().optional(),
  bio: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  instagram: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (await isRateLimited(`rl:register:${ip}`, 5, 3600)) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde um momento.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { email, password, slug, businessName, category, bio, phone, whatsapp, instagram, city, country, currency } = parsed.data;

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

  return NextResponse.json({ success: true });
}
