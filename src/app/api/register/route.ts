import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password, slug, businessName, category, bio, phone, whatsapp, instagram, city } = body;

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
