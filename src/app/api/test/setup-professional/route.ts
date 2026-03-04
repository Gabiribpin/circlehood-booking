import { logger } from '@/lib/logger';
/**
 * POST /api/test/setup-professional
 *
 * Cria um profissional efémero para testes E2E.
 * Bloqueado em produção (NODE_ENV === 'production').
 *
 * Body:
 *   name, email, requireDeposit, depositAmount (centavos),
 *   stripeAccountId?, services: [{ name, duration, price }]
 *
 * Response:
 *   { userId, professionalId, email, slug, services }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ALLOWED_ENVS = ['test', 'development'];

function serviceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const testSecret = process.env.E2E_TEST_SECRET;
  if (
    !ALLOWED_ENVS.includes(process.env.NODE_ENV ?? '') ||
    !testSecret ||
    request.headers.get('x-test-secret') !== testSecret
  ) {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }

  const supabase = serviceRoleClient();

  try {
    const body = await request.json();
    const {
      name,
      email,
      requireDeposit = false,
      depositAmount = 0,
      depositType = 'fixed',
      stripeAccountId = null,
      services = [],
    } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'name and email are required' }, { status: 400 });
    }

    // 1. Criar utilizador
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: { name, role: 'professional' },
    });

    if (userError) throw userError;
    const userId = userData.user.id;

    // 2. Gerar slug único
    const baseSlug = email.split('@')[0].replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const slug = `${baseSlug}-${Date.now()}`;

    // 3. Criar perfil do profissional
    const { data: professional, error: profError } = await supabase
      .from('professionals')
      .insert({
        user_id: userId,
        name,
        email,
        slug,
        is_active: true,
        require_deposit: requireDeposit,
        deposit_type: requireDeposit ? depositType : null,
        deposit_value: requireDeposit ? depositAmount / 100 : null, // centavos → unidade
        stripe_account_id: stripeAccountId,
        stripe_onboarding_completed: !!stripeAccountId,
      })
      .select()
      .single();

    if (profError) throw profError;

    // 4. Criar serviços
    let createdServices: any[] = [];
    if (services.length > 0) {
      const serviceRows = services.map((s: any) => ({
        professional_id: professional.id,
        name: s.name,
        duration_minutes: s.duration ?? 60,
        price: (s.price ?? 0) / 100, // centavos → unidade
        is_active: true,
      }));

      const { data: svcData, error: svcError } = await supabase
        .from('services')
        .insert(serviceRows)
        .select();

      if (svcError) throw svcError;
      createdServices = svcData ?? [];
    }

    // 5. Criar horários de trabalho (seg–sex 09:00–18:00)
    const workingHoursRows = [1, 2, 3, 4, 5].map((day) => ({
      professional_id: professional.id,
      day_of_week: day,
      start_time: '09:00',
      end_time: '18:00',
      is_available: true,
    }));

    await supabase.from('working_hours').insert(workingHoursRows);

    return NextResponse.json({
      userId,
      professionalId: professional.id,
      email,
      slug,
      services: createdServices.map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        duration: s.duration_minutes,
      })),
    });
  } catch (err: any) {
    logger.error('[test/setup-professional]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
