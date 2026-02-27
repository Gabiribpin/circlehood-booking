import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateIBAN } from '@/lib/validators/iban';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!professional) {
    return NextResponse.json({ error: 'Profissional não encontrado' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  const { method } = body;

  if (method === 'stripe_pending') {
    const { full_name, dob, iban, address_line1, address_line2, city, postal_code, country } = body as Record<string, string>;

    // Validar campos obrigatórios
    if (!full_name?.trim()) {
      return NextResponse.json({ error: 'Nome completo é obrigatório' }, { status: 400 });
    }
    if (!dob) {
      return NextResponse.json({ error: 'Data de nascimento é obrigatória' }, { status: 400 });
    }
    if (!address_line1?.trim()) {
      return NextResponse.json({ error: 'Morada é obrigatória' }, { status: 400 });
    }
    if (!city?.trim()) {
      return NextResponse.json({ error: 'Cidade é obrigatória' }, { status: 400 });
    }
    if (!postal_code?.trim()) {
      return NextResponse.json({ error: 'Código postal é obrigatório' }, { status: 400 });
    }

    // Validar idade (18+)
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) {
      return NextResponse.json({ error: 'Data de nascimento inválida' }, { status: 400 });
    }
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const isUnderage =
      age < 18 || (age === 18 && (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())));
    if (isUnderage) {
      return NextResponse.json({ error: 'É necessário ter 18 anos ou mais' }, { status: 400 });
    }

    // Validar IBAN (se fornecido)
    if (iban?.trim()) {
      if (!validateIBAN(iban)) {
        return NextResponse.json({ error: 'IBAN inválido. Verifique o número e tente novamente.' }, { status: 400 });
      }
    }

    const { error } = await supabase
      .from('professionals')
      .update({
        payment_method: 'stripe_pending',
        payment_full_name: full_name.trim(),
        payment_dob: dob,
        payment_iban: iban?.replace(/\s+/g, '').toUpperCase() || null,
        payment_address_line1: address_line1.trim(),
        payment_address_line2: address_line2?.trim() || null,
        payment_city: city.trim(),
        payment_postal_code: postal_code.trim(),
        payment_country: (country || 'IE').toUpperCase(),
        stripe_onboarding_status: 'pending',
      })
      .eq('id', professional.id);

    if (error) {
      return NextResponse.json({ error: 'Erro ao salvar configuração' }, { status: 500 });
    }

    return NextResponse.json({ success: true, method: 'stripe_pending' });
  }

  if (method === 'manual') {
    const { manual_payment_key } = body as Record<string, string>;

    if (!manual_payment_key?.trim()) {
      return NextResponse.json({ error: 'Chave de pagamento é obrigatória' }, { status: 400 });
    }

    const { error } = await supabase
      .from('professionals')
      .update({
        payment_method: 'manual',
        manual_payment_key: manual_payment_key.trim(),
        stripe_onboarding_status: 'pending',
      })
      .eq('id', professional.id);

    if (error) {
      return NextResponse.json({ error: 'Erro ao salvar configuração' }, { status: 500 });
    }

    return NextResponse.json({ success: true, method: 'manual' });
  }

  return NextResponse.json({ error: 'Método de pagamento inválido' }, { status: 400 });
}
