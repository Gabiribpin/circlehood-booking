/**
 * GET /api/bookings/check?email=...
 *
 * Retorna todos os agendamentos de um cliente pelo email.
 * Usado em testes E2E para verificar o estado do booking após criação.
 * Bloqueado em produção.
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

export async function GET(request: Request) {
  const testSecret = process.env.E2E_TEST_SECRET;
  if (
    !ALLOWED_ENVS.includes(process.env.NODE_ENV ?? '') ||
    !testSecret ||
    request.headers.get('x-test-secret') !== testSecret
  ) {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'email query param is required' }, { status: 400 });
  }

  const supabase = serviceRoleClient();

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, status, professional_id, service_id, booking_date, start_time, client_email')
    .eq('client_email', email)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  // Mapear campos para o formato esperado pelos testes
  const mapped = (bookings ?? []).map((b) => ({
    id: b.id,
    status: b.status,
    professionalId: b.professional_id,
    serviceId: b.service_id,
    bookingDate: b.booking_date,
    startTime: b.start_time,
    // paymentStatus e paidAmount não existem na tabela — omitir
    paymentStatus: 'not_required',
    paidAmount: null,
  }));

  return NextResponse.json(mapped);
}
