import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripeServer } from '@/lib/stripe/server';
import { calculateDeposit, toCents } from '@/lib/payment/calculate-deposit';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  const { professional_id, service_id, idempotency_key: clientKey } = body as {
    professional_id?: string;
    service_id?: string;
    idempotency_key?: string;
  };

  if (!professional_id || !service_id) {
    return NextResponse.json(
      { error: 'professional_id e service_id são obrigatórios' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Buscar configuração de depósito do profissional
  const { data: professional } = await supabase
    .from('professionals')
    .select('require_deposit, deposit_type, deposit_value, currency')
    .eq('id', professional_id)
    .single();

  if (!professional) {
    return NextResponse.json({ error: 'Profissional não encontrado' }, { status: 404 });
  }

  if (!professional.require_deposit) {
    return NextResponse.json(
      { error: 'Este profissional não exige sinal' },
      { status: 400 }
    );
  }

  if (!professional.deposit_type || professional.deposit_value == null) {
    return NextResponse.json(
      { error: 'Configuração de sinal incompleta' },
      { status: 400 }
    );
  }

  // Buscar preço do serviço
  const { data: service } = await supabase
    .from('services')
    .select('price, name')
    .eq('id', service_id)
    .eq('professional_id', professional_id)
    .single();

  if (!service) {
    return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 });
  }

  const depositAmount = calculateDeposit(
    service.price,
    professional.deposit_type as 'percentage' | 'fixed',
    professional.deposit_value
  );

  if (depositAmount <= 0) {
    return NextResponse.json({ error: 'Valor do sinal inválido' }, { status: 400 });
  }

  const stripe = getStripeServer();
  if (!stripe) {
    return NextResponse.json(
      { error: 'Pagamento online não configurado' },
      { status: 503 }
    );
  }

  const currency = (professional.currency ?? 'EUR').toLowerCase();

  try {
    // Idempotency key: usa key do frontend se enviada (retry-safe), senão gera UUID
    const idempotencyKey = clientKey || `pi:${professional_id}:${service_id}:${crypto.randomUUID()}`;

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: toCents(depositAmount),
        currency,
        metadata: {
          professional_id,
          service_id,
          service_name: service.name,
          deposit_type: professional.deposit_type,
          deposit_value: String(professional.deposit_value),
        },
        // Permite cards e outros métodos automaticamente
        automatic_payment_methods: { enabled: true },
      },
      { idempotencyKey }
    );

    // Salvar registro de pagamento pendente
    await supabase.from('payments').insert({
      professional_id,
      booking_id: null,
      stripe_payment_intent_id: paymentIntent.id,
      amount: depositAmount,
      currency: professional.currency ?? 'EUR',
      status: 'pending',
      metadata: {
        service_id,
        service_name: service.name,
      },
    });

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      amount: depositAmount,
      currency: professional.currency ?? 'EUR',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao criar intenção de pagamento';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
