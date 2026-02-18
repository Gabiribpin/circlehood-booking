import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getDaysUntilBirthday(birthdayStr: string, today: Date): number {
  const birthday = new Date(birthdayStr);

  // Construir a data de aniversário no ano atual
  let thisYearBirthday = new Date(
    today.getFullYear(),
    birthday.getMonth(),
    birthday.getDate()
  );

  // Se o aniversário já passou este ano, usar o próximo ano
  if (thisYearBirthday < today) {
    thisYearBirthday = new Date(
      today.getFullYear() + 1,
      birthday.getMonth(),
      birthday.getDate()
    );
  }

  return Math.ceil(
    (thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function formatBirthdayDate(birthdayStr: string, today: Date): string {
  const birthday = new Date(birthdayStr);
  let targetDate = new Date(
    today.getFullYear(),
    birthday.getMonth(),
    birthday.getDate()
  );
  if (targetDate < today) {
    targetDate = new Date(
      today.getFullYear() + 1,
      birthday.getMonth(),
      birthday.getDate()
    );
  }
  return targetDate.toISOString().split('T')[0];
}

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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();

  let created = 0;
  let skipped = 0;

  try {
    // 1. Buscar todos os profissionais ativos ou em trial
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

    // 2. Para cada profissional, verificar aniversariantes nos próximos 7 dias
    for (const professional of professionals) {
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, name, birthday')
        .eq('professional_id', professional.id)
        .not('birthday', 'is', null);

      if (contactsError) {
        console.error(`Error fetching contacts for ${professional.business_name}:`, contactsError);
        continue;
      }

      if (!contacts || contacts.length === 0) continue;

      // Filtrar contatos com aniversário nos próximos 7 dias
      const upcomingBirthdays = contacts.filter((contact) => {
        const days = getDaysUntilBirthday(contact.birthday!, today);
        return days >= 0 && days <= 7;
      });

      for (const contact of upcomingBirthdays) {
        const daysUntil = getDaysUntilBirthday(contact.birthday!, today);
        const birthdayDate = formatBirthdayDate(contact.birthday!, today);

        // 3. Verificar se já existe notificação para esse aniversário este ano
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', professional.user_id)
          .eq('type', 'birthday')
          .eq('client_id', contact.id)
          .filter('metadata->>year', 'eq', String(currentYear))
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        // 4. Criar notificação de aniversário
        const message =
          daysUntil === 0
            ? `🎂 ${contact.name} faz aniversário HOJE!`
            : daysUntil === 1
              ? `🎂 ${contact.name} faz aniversário amanhã`
              : `🎂 ${contact.name} faz aniversário em ${daysUntil} dias (${birthdayDate})`;

        // Agendar para 9h da manhã do dia do aniversário
        const scheduledFor = new Date(`${birthdayDate}T09:00:00.000Z`).toISOString();

        const { error: insertError } = await supabase
          .from('notifications')
          .insert({
            user_id: professional.user_id,
            client_id: contact.id,
            type: 'birthday',
            title: '🎂 Aniversário',
            message,
            scheduled_for: scheduledFor,
            status: 'pending',
            channel: 'whatsapp',
            metadata: {
              contact_id: contact.id,
              contact_name: contact.name,
              birthday_date: birthdayDate,
              days_until: daysUntil,
              year: currentYear,
            },
          });

        if (insertError) {
          console.error(`Error inserting birthday notification for ${contact.name}:`, insertError);
          continue;
        }

        created++;
      }
    }

    return NextResponse.json({ created, skipped });
  } catch (error: any) {
    console.error('Fatal error in birthdays cron:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
