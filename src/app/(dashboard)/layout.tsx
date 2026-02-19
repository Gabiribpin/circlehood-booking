import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { MobileNav } from '@/components/dashboard/mobile-nav';
import {
  LayoutDashboard,
  Scissors,
  CalendarDays,
  Clock,
  Palette,
  Settings,
  LogOut,
  Users,
  UserCheck,
  Megaphone,
  QrCode,
  BarChart3,
  FileEdit,
  ImageIcon,
  MessageSquare,
  Zap,
  Phone,
} from 'lucide-react';

const BASE_NAV_ITEMS = [
  { href: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { href: '/services', label: 'Serviços', icon: Scissors },
  { href: '/bookings', label: 'Agendamentos', icon: CalendarDays },
  { href: '/schedule', label: 'Horários', icon: Clock },
  { href: '/contacts', label: 'Contatos', icon: Users },
  { href: '/clients', label: 'Clientes', icon: UserCheck },
  { href: '/campaigns', label: 'Campanhas', icon: Megaphone },
  { href: '/marketing', label: 'Marketing', icon: QrCode },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/automations', label: 'Automações', icon: Zap },
  { href: '/whatsapp-config', label: 'WhatsApp Bot', icon: Phone },
  { href: '/my-page-editor', label: 'Editor de Página', icon: FileEdit },
  { href: '/gallery', label: 'Galeria', icon: ImageIcon },
  { href: '/testimonials', label: 'Depoimentos', icon: MessageSquare },
  { href: '/my-page', label: 'Minha Página', icon: Palette },
  { href: '/settings', label: 'Configurações', icon: Settings },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [{ data: professional }, { data: whatsappConfig }] = await Promise.all([
    supabase.from('professionals').select('business_name, slug').eq('user_id', user.id).single(),
    supabase.from('whatsapp_config').select('provider, is_active').eq('user_id', user.id).single(),
  ]);

  const hasMetaBusiness = whatsappConfig?.provider === 'meta' && whatsappConfig?.is_active === true;

  const NAV_ITEMS = BASE_NAV_ITEMS.map((item) =>
    item.href === '/campaigns'
      ? { ...item, badge: !hasMetaBusiness ? '🔒' : null }
      : item
  );

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-muted/30">
        <div className="p-6">
          <Link href="/dashboard" className="text-lg font-bold">
            CircleHood
          </Link>
          {professional && (
            <p className="text-sm text-muted-foreground mt-1 truncate">
              {professional.business_name}
            </p>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {'badge' in item && item.badge && (
                <span className="ml-auto text-xs" title="Requer WhatsApp Business">{item.badge}</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t">
          {professional && (
            <a
              href={`/${professional.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Ver minha página pública &rarr;
            </a>
          )}
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground w-full rounded-md hover:bg-accent transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex-1 flex flex-col">
        <header className="md:hidden border-b p-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-lg font-bold">
            CircleHood
          </Link>
        </header>

        {/* Mobile bottom nav */}
        <MobileNav professionalSlug={professional?.slug} />

        <main className="flex-1 p-4 sm:p-6 md:p-8 pb-20 md:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
