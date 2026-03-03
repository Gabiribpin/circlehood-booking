import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!professional) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const clientType = searchParams.get('type'); // 'new', 'occasional', 'recurring'
  const engagementStatus = searchParams.get('status'); // 'active', 'at_risk', 'churned'
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  try {
    // Buscar todos os agendamentos confirmados com preço do serviço
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('client_phone, client_name, booking_date, status, service_id')
      .eq('professional_id', professional.id)
      .neq('status', 'cancelled');

    if (bookingsError) throw bookingsError;

    // Buscar preços dos serviços
    const serviceIds = [
      ...new Set((bookings ?? []).map((b) => b.service_id).filter(Boolean)),
    ];
    const priceMap: Record<string, number> = {};

    if (serviceIds.length > 0) {
      const { data: services } = await supabase
        .from('services')
        .select('id, price')
        .in('id', serviceIds);
      for (const s of services ?? []) {
        priceMap[s.id] = Number(s.price ?? 0);
      }
    }

    // Agregar por cliente
    const clientMap = new Map<
      string,
      {
        client_phone: string;
        client_name: string;
        first_booking_date: string;
        last_booking_date: string;
        total_bookings: number;
        total_spent: number;
      }
    >();

    const today = new Date().toISOString().split('T')[0];

    for (const b of bookings ?? []) {
      const phone = b.client_phone ?? 'unknown';
      const price = priceMap[b.service_id] ?? 0;

      if (!clientMap.has(phone)) {
        clientMap.set(phone, {
          client_phone: phone,
          client_name: b.client_name ?? '',
          first_booking_date: b.booking_date,
          last_booking_date: b.booking_date,
          total_bookings: 0,
          total_spent: 0,
        });
      }

      const c = clientMap.get(phone)!;
      c.total_bookings++;
      c.total_spent += price;
      if (b.booking_date < c.first_booking_date) c.first_booking_date = b.booking_date;
      if (b.booking_date > c.last_booking_date) c.last_booking_date = b.booking_date;
      // Atualizar nome se o atual está vazio
      if (!c.client_name && b.client_name) c.client_name = b.client_name;
    }

    // Classificar clientes
    let clients = Array.from(clientMap.values()).map((c) => {
      const daysSinceLast = Math.floor(
        (new Date(today).getTime() - new Date(c.last_booking_date).getTime()) / 86400000,
      );

      const client_type =
        c.total_bookings === 1 ? 'new' : c.total_bookings <= 3 ? 'occasional' : 'recurring';

      const engagement_status =
        daysSinceLast <= 30 ? 'active' : daysSinceLast <= 90 ? 'at_risk' : 'churned';

      const lifetime_value = c.total_spent;
      const avg_ticket = c.total_bookings > 0 ? c.total_spent / c.total_bookings : 0;

      return {
        ...c,
        days_since_last_booking: daysSinceLast,
        client_type,
        engagement_status,
        lifetime_value,
        avg_ticket,
      };
    });

    // Aplicar filtros
    if (clientType) clients = clients.filter((c) => c.client_type === clientType);
    if (engagementStatus)
      clients = clients.filter((c) => c.engagement_status === engagementStatus);

    // Ordenar por LTV decrescente
    clients.sort((a, b) => b.lifetime_value - a.lifetime_value);

    // Estatísticas gerais (antes de paginar)
    const stats = {
      total: clients.length,
      byType: {
        new: clients.filter((c) => c.client_type === 'new').length,
        occasional: clients.filter((c) => c.client_type === 'occasional').length,
        recurring: clients.filter((c) => c.client_type === 'recurring').length,
      },
      byEngagement: {
        active: clients.filter((c) => c.engagement_status === 'active').length,
        at_risk: clients.filter((c) => c.engagement_status === 'at_risk').length,
        churned: clients.filter((c) => c.engagement_status === 'churned').length,
      },
    };

    // Paginar
    const paginated = clients.slice(offset, offset + limit);

    return NextResponse.json({
      clients: paginated,
      stats,
      pagination: { limit, offset, total: clients.length },
      computedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching client analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
