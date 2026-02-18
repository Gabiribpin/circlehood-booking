import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Verificar autorização do cron
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Service role — sem sessão de usuário
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Agendar notificação para 9h da manhã de amanhã
  const scheduledFor = new Date(`${tomorrowStr}T09:00:00.000Z`).toISOString();

  let created = 0;
  let skipped = 0;

  try {
    // 1. Buscar todos os profissionais com assinatura ativa ou em trial
    const { data: professionals, error: profError } = await supabase
      .from('professionals')
      .select('id, user_id, business_name')
      .in('subscription_status', ['active', 'trial']);

    if (profError) {
      throw new Error(`Error fetching professionals: ${profError.message}`);
    }

    if (!professionals || professionals.length === 0) {
      return NextResponse.json({ created: 0, skipped: 0, message: 'No active professionals' });
    }

    // 2. Para cada profissional, processar agendamentos de amanhã
    for (const professional of professionals) {
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, client_name, start_time, contact_id, service_id, services(name)')
        .eq('professional_id', professional.id)
        .eq('booking_date', tomorrowStr)
        .eq('status', 'confirmed');

      if (bookingsError) {
        console.error(`Error fetching bookings for ${professional.business_name}:`, bookingsError);
        continue;
      }

      if (!bookings || bookings.length === 0) continue;

      for (const booking of bookings) {
        // 3. Verificar se já existe notificação de lembrete para esse booking
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', professional.user_id)
          .eq('type', 'reminder')
          .filter('metadata->>booking_id', 'eq', booking.id)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        // 4. Criar notificação
        const servicesData = booking.services as { name: string }[] | { name: string } | null;
        const serviceName = Array.isArray(servicesData)
          ? (servicesData[0]?.name ?? 'Serviço')
          : (servicesData?.name ?? 'Serviço');
        const time = booking.start_time.slice(0, 5);

        const { error: insertError } = await supabase
          .from('notifications')
          .insert({
            user_id: professional.user_id,
            client_id: booking.contact_id ?? null,
            type: 'reminder',
            title: 'Lembrete de Agendamento',
            message: `${booking.client_name} — ${serviceName} amanhã às ${time}`,
            scheduled_for: scheduledFor,
            status: 'pending',
            channel: 'whatsapp',
            metadata: {
              booking_id: booking.id,
              service_name: serviceName,
              start_time: time,
              date: tomorrowStr,
            },
          });

        if (insertError) {
          console.error(`Error inserting notification for booking ${booking.id}:`, insertError);
          continue;
        }

        created++;
      }
    }

    return NextResponse.json({ created, skipped });
  } catch (error: any) {
    console.error('Fatal error in reminders cron:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
