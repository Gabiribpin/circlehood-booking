import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { EmailNotificationsManager } from '@/components/dashboard/email-notifications-manager';

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!professional) redirect('/onboarding');

  // Últimas 100 notificações (email + whatsapp) nos últimos 30 dias
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: logs } = await supabase
    .from('notification_logs')
    .select('id, channel, type, recipient, message, status, error_message, booking_id, created_at')
    .eq('professional_id', professional.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <EmailNotificationsManager
      logs={logs || []}
      professionalId={professional.id}
    />
  );
}
