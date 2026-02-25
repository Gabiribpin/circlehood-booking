import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { LayoutDashboard, CreditCard, ShieldCheck, LifeBuoy } from 'lucide-react';
import { AdminLogoutButton } from '@/components/admin/admin-logout-button';

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
