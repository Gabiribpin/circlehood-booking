import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();

  try {
    // Buscar token
    const { data: tokenData, error: tokenError } = await supabase
      .from('reschedule_tokens')
      .select(
        `
        *,
        bookings (
          id,
          booking_date,
          booking_time,
          contact_name,
          contact_phone,
          status,
          service_id,
          professional_id,
          services (name, price, duration_minutes),
          professionals (business_name, slug, city, address, phone)
        )
      `
      )
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json({ valid: false, error: 'Token inválido' }, { status: 404 });
    }

    // Verificar se token expirou
    if (new Date(tokenData.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: 'Token expirado' }, { status: 410 });
    }

    // Verificar se já foi usado
    if (tokenData.used) {
      return NextResponse.json({ valid: false, error: 'Token já utilizado' }, { status: 410 });
    }

    // Verificar se booking ainda está ativo
    if (tokenData.bookings.status === 'cancelled') {
      return NextResponse.json(
        { valid: false, error: 'Agendamento já cancelado' },
        { status: 410 }
      );
    }

    return NextResponse.json({
      valid: true,
      booking: tokenData.bookings,
      token: token,
    });
  } catch (error: any) {
    console.error('Error validating token:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
