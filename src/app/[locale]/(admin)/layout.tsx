import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { LayoutDashboard, CreditCard, LogOut, ShieldCheck, LifeBuoy } from 'lucide-react';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user }, error: getUserError } = await supabase.auth.getUser();

  const adminEmail = process.env.ADMIN_EMAIL;
  const { cookies: getCookies } = await import('next/headers');
  const cookieStore = await getCookies();
  const allCookies = cookieStore.getAll();
  const hasAuthCookie = allCookies.some(c => c.name.includes('auth-token') || c.name.includes('sb-'));

  console.log('[ADMIN DEBUG 2]', {
    userEmail: user?.email,
    adminEmail,
    getUserError: getUserError?.message,
    hasAuthCookie,
    cookieCount: allCookies.length,
    cookieNames: allCookies.map(c => c.name),
  });

  if (!user || !adminEmail || user.email?.trim().toLowerCase() !== adminEmail.trim().toLowerCase()) {
    redirect('/login');
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

        <div className="p-3 border-t border-slate-800 space-y-2">
          <p className="px-3 text-[10px] text-slate-500 truncate">{user.email}</p>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-white w-full hover:bg-slate-800 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-slate-50 dark:bg-background overflow-auto">
        {children}
      </main>
    </div>
  );
}
