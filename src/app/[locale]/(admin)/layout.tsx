import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { LayoutDashboard, CreditCard, ShieldCheck, LifeBuoy, Trash2, Target, BookOpen, Phone, Crosshair, Radar } from 'lucide-react';
import { AdminLogoutButton } from '@/components/admin/admin-logout-button';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const adminSession = cookieStore.get('admin_session');

  if (adminSession?.value !== '1') {
    redirect('/admin-login');
  }

  const supabase = createAdminClient();

  // Badge: contas marcadas para exclusão (ainda no período de 30 dias)
  const { count: deletedCount } = await supabase
    .from('professionals')
    .select('*', { count: 'exact', head: true })
    .not('deleted_at', 'is', null)
    .gt('deletion_scheduled_for', new Date().toISOString());
  const pendingDeletions = deletedCount ?? 0;

  // Badge: WhatsApp vendas conectado
  const SALES_INSTANCE = process.env.EVOLUTION_INSTANCE_SALES ?? 'circlehood-sales';
  const { data: salesWhatsapp } = await supabase
    .from('whatsapp_config')
    .select('is_active')
    .eq('evolution_instance', SALES_INSTANCE)
    .maybeSingle();
  const salesConnected = salesWhatsapp?.is_active === true;

  // Badge: leads novos não contactados
  const { count: newLeadsCount } = await supabase
    .from('sales_leads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'new');
  const newLeads = newLeadsCount ?? 0;

  return (
    <div className="min-h-screen flex">
      {/* Dark admin sidebar */}
      <aside className="w-56 bg-slate-900 text-slate-100 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-indigo-400" />
            <p className="text-sm font-bold text-white">CircleHood Tech</p>
          </div>
          <p className="text-xs text-slate-400">Painel Admin</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard de Vendas
          </Link>
          <Link
            href="/admin/payments"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <CreditCard className="h-4 w-4" />
            Recebimentos
          </Link>
          <Link
            href="/admin/support"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LifeBuoy className="h-4 w-4" />
            Chamados
          </Link>
          <Link
            href="/admin/handbook"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            Handbook
          </Link>
          <Link
            href="/admin/whatsapp-config"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Phone className="h-4 w-4" />
            WhatsApp Vendas
            <span className={`ml-auto h-2 w-2 rounded-full ${salesConnected ? 'bg-green-400' : 'bg-red-400'}`} />
          </Link>
          <Link
            href="/admin/leads"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Target className="h-4 w-4" />
            Leads de Vendas
            {newLeads > 0 && (
              <span className="ml-auto text-[10px] font-bold bg-indigo-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                {newLeads}
              </span>
            )}
          </Link>
          <Link
            href="/admin/deleted-accounts"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Contas Excluídas
            {pendingDeletions > 0 && (
              <span className="ml-auto text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                {pendingDeletions}
              </span>
            )}
          </Link>

          <div className="my-2 border-t border-slate-800" />

          <Link
            href="/admin/execution"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Crosshair className="h-4 w-4" />
            Execucao Atual
          </Link>
          <Link
            href="/admin/control-center"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Radar className="h-4 w-4" />
            Control Center
          </Link>
        </nav>

        <div className="p-3 border-t border-slate-800">
          <AdminLogoutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-slate-50 dark:bg-background overflow-auto">
        {children}
      </main>
    </div>
  );
}
