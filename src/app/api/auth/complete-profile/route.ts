import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const bodySchema = z.object({
  business_name: z.string().min(1).max(100),
  slug: z.string().min(3).max(60).regex(/^[a-z0-9-]+$/),
  city: z.string().min(1).max(100),
  country: z.string().length(2),
  category: z.string().max(100).nullable().optional(),
  currency: z.string().min(3).max(3).default('eur'),
  locale: z.string().max(10).default('pt-BR'),
});

export async function POST(req: NextRequest) {
  // 1. Validate session
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  // 2. Parse & validate body
  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await req.json();
    body = bodySchema.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 3. Check if professional already exists
  const { data: existing } = await admin
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Perfil já existe.', redirect: '/dashboard' }, { status: 409 });
  }

  // 4. Check slug uniqueness
  const { data: slugTaken } = await admin
    .from('professionals')
    .select('id')
    .eq('slug', body.slug)
    .maybeSingle();

  if (slugTaken) {
    return NextResponse.json({ error: 'Este link já está em uso.' }, { status: 400 });
  }

  // 5. Create professional record
  // Nota: professionals não tem coluna 'email' — email fica em auth.users
  // trial_ends_at e subscription_status têm defaults no DB, mas setamos explicitamente
  const { error: insertError } = await admin
    .from('professionals')
    .insert({
      user_id: user.id,
      business_name: body.business_name,
      slug: body.slug,
      city: body.city,
      country: body.country,
      category: body.category || null,
      currency: body.currency,
      locale: body.locale,
      email_verified: true, // OAuth confirms email
    } as never);

  if (insertError) {
    logger.error('[complete-profile] insert error:', insertError);
    return NextResponse.json({ error: 'Erro ao criar perfil.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, redirect: '/subscribe' }, { status: 201 });
}
