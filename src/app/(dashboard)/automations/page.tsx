import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AutomationsManager } from './automations-manager';

export default async function AutomationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: professional } = await supabase
    .from('professionals')
    .select('id, business_name')
    .eq('user_id', user.id)
    .single();

  if (!professional) {
    redirect('/onboarding');
  }

  // Buscar logs de cron jobs (últimos 30)
  const { data: cronLogs } = await supabase
    .from('cron_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  // Buscar logs de notificações do profissional (últimas 50)
  const { data: notificationLogs } = await supabase
    .from('notification_logs')
    .select('*')
    .eq('professional_id', professional.id)
    .order('created_at', { ascending: false })
    .limit(50);

  // Estatísticas
  const { count: totalNotifications } = await supabase
    .from('notification_logs')
    .select('*', { count: 'exact', head: true })
    .eq('professional_id', professional.id);

  const { count: pendingQueue } = await supabase
    .from('notification_queue')
    .select('*', { count: 'exact', head: true })
    .eq('professional_id', professional.id)
    .eq('status', 'pending');

  return (
    <AutomationsManager
      professional={professional}
      cronLogs={cronLogs || []}
      notificationLogs={notificationLogs || []}
      stats={{
        totalNotifications: totalNotifications || 0,
        pendingQueue: pendingQueue || 0,
      }}
    />
  );
}
