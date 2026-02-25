'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    router.push('/admin-login');
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-white w-full hover:bg-slate-800 transition-colors"
    >
      <LogOut className="h-4 w-4" />
      Sair do admin
    </button>
  );
}
