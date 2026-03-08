import { createAdminClient } from '@/lib/supabase/admin';
import { StatusDashboard } from './status-dashboard';

export default async function AdminStatusPage() {
  const supabase = createAdminClient();

  // Cron logs últimas 24h
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: cronLogs } = await supabase
    .from('cron_logs')
    .select('*')
    .gt('created_at', twentyFourHoursAgo)
    .order('created_at', { ascending: false })
    .limit(100);

  // Webhook failures últimas 24h
  const { data: webhookFailures } = await supabase
    .from('cron_logs')
    .select('*')
    .like('job_name', 'webhook_%')
    .eq('status', 'error')
    .gt('created_at', twentyFourHoursAgo)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Status do Sistema</h1>
      <StatusDashboard
        cronLogs={cronLogs ?? []}
        webhookFailures={webhookFailures ?? []}
      />
    </div>
  );
}
