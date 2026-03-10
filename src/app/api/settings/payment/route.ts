import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: professional, error } = await supabase
    .from('professionals')
    .select(
      'require_deposit, deposit_type, deposit_value, stripe_onboarding_completed'
    )
    .eq('user_id', user.id)
    .single();

  if (error || !professional) {
    return NextResponse.json({ error: 'Profissional não encontrado' }, { status: 404 });
  }

  return NextResponse.json({ professional });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  const { require_deposit, deposit_type, deposit_value } = body as {
    require_deposit?: boolean;
    deposit_type?: 'percentage' | 'fixed';
    deposit_value?: number;
  };

  // Validação básica
  if (require_deposit) {
    if (!deposit_type || !['percentage', 'fixed'].includes(deposit_type)) {
      return NextResponse.json(
        { error: 'Tipo de sinal inválido (percentage ou fixed)' },
        { status: 400 }
      );
    }
    if (deposit_value == null || deposit_value <= 0) {
      return NextResponse.json({ error: 'Valor do sinal deve ser maior que zero' }, { status: 400 });
    }
    if (deposit_type === 'percentage' && deposit_value > 100) {
      return NextResponse.json({ error: 'Percentagem não pode exceder 100%' }, { status: 400 });
    }
  }

  const { error } = await supabase
    .from('professionals')
    .update({
      require_deposit: require_deposit ?? false,
      deposit_type: require_deposit ? deposit_type : null,
      deposit_value: require_deposit ? deposit_value : null,
    })
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Erro ao salvar configurações' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
