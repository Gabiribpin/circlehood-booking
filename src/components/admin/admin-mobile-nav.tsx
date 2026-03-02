'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Menu,
  X,
  LayoutDashboard,
  CreditCard,
  LifeBuoy,
  BookOpen,
  Phone,
  Target,
  Trash2,
  LogOut,
  ShieldCheck,
} from 'lucide-react';

const navItems = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard de Vendas' },
  { href: '/admin/payments', icon: CreditCard, label: 'Recebimentos' },
  { href: '/admin/support', icon: LifeBuoy, label: 'Chamados' },
  { href: '/admin/handbook', icon: BookOpen, label: 'Handbook' },
  { href: '/admin/whatsapp-config', icon: Phone, label: 'WhatsApp Vendas' },
  { href: '/admin/leads', icon: Target, label: 'Leads de Vendas' },
  { href: '/admin/deleted-accounts', icon: Trash2, label: 'Contas Excluídas' },
];

interface AdminMobileNavProps {
  salesConnected: boolean;
  newLeads: number;
  pendingDeletions: number;
}

export function AdminMobileNav({ salesConnected, newLeads, pendingDeletions }: AdminMobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Strip locale prefix for matching
  const cleanPath = pathname.replace(/^\/(pt-BR|en-US|es-ES)/, '');

  async function handleLogout() {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    window.location.href = '/admin-login';
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-900 text-white">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-bold">CircleHood Admin</span>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="p-1.5 rounded-md hover:bg-slate-800 transition-colors"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile overlay + drawer */}
      {open && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setOpen(false)}
          />
          <nav className="lg:hidden fixed top-0 left-0 bottom-0 w-64 bg-slate-900 text-slate-100 z-50 flex flex-col shadow-xl animate-in slide-in-from-left duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="h-4 w-4 text-indigo-400" />
                  <p className="text-sm font-bold text-white">CircleHood Tech</p>
                </div>
                <p className="text-xs text-slate-400">Painel Admin</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = cleanPath.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                    {item.href === '/admin/whatsapp-config' && (
                      <span className={`ml-auto h-2 w-2 rounded-full ${salesConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                    )}
                    {item.href === '/admin/leads' && newLeads > 0 && (
                      <span className="ml-auto text-[10px] font-bold bg-indigo-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                        {newLeads}
                      </span>
                    )}
                    {item.href === '/admin/deleted-accounts' && pendingDeletions > 0 && (
                      <span className="ml-auto text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                        {pendingDeletions}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            <div className="p-3 border-t border-slate-800">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-slate-400 hover:text-white w-full hover:bg-slate-800 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sair do admin
              </button>
            </div>
          </nav>
        </>
      )}
    </>
  );
}
