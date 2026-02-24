import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { MobileNav } from '@/components/dashboard/mobile-nav';
import { CircleHoodLogoCompact } from '@/components/branding/logo';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { GuidedTour } from '@/components/onboarding/guided-tour';
import { getTranslations } from 'next-intl/server';
import {
  LayoutDashboard,
  Scissors,
  CalendarDays,
  Clock,
  Palette,
  Settings,
  LogOut,
  Users,
  QrCode,
  BarChart3,
  FileEdit,
  ImageIcon,
  MessageSquare,
  Zap,
  Phone,
  Bell,
  LifeBuoy,
} from 'lucide-react';

// data-tour-id values for guided tour — keyed by nav href
const TOUR_IDS: Partial<Record<string, string>> = {
  '/services': 'services',
  '/schedule': 'schedule',
  '/whatsapp-config': 'whatsapp',
  '/my-page': 'my-page',
};

// Nav item definitions — labels injected at render time via t()
const NAV_ITEM_DEFS = [
  { href: '/dashboard', tKey: 'dashboard', icon: LayoutDashboard },
  { href: '/services', tKey: 'services', icon: Scissors },
  { href: '/bookings', tKey: 'bookings', icon: CalendarDays },
  { href: '/schedule', tKey: 'schedule', icon: Clock },
  { href: '/clients', tKey: 'clients', icon: Users },
  { href: '/marketing', tKey: 'marketing', icon: QrCode },
  { href: '/analytics', tKey: 'analytics', icon: BarChart3 },
  { href: '/automations', tKey: 'automations', icon: Zap },
  { href: '/notifications', tKey: 'notifications', icon: Bell },
  { href: '/whatsapp-config', tKey: 'whatsapp', icon: Phone },
  { href: '/my-page-editor', tKey: 'pageEditor', icon: FileEdit },
  { href: '/gallery', tKey: 'gallery', icon: ImageIcon },
  { href: '/testimonials', tKey: 'testimonials', icon: MessageSquare },
  { href: '/my-page', tKey: 'myPage', icon: Palette },
  { href: '/settings', tKey: 'settings', icon: Settings },
  { href: '/support', tKey: 'support', icon: LifeBuoy },
] as const;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations('nav');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: professional } = await supabase
    .from('professionals')
    .select('business_name, slug')
    .eq('user_id', user.id)
    .single();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-muted/30">
        <div className="p-4 pb-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <CircleHoodLogoCompact size="sm" />
            <span className="text-sm font-bold leading-tight">CircleHood<br /><span className="text-xs font-normal text-muted-foreground">Booking</span></span>
          </Link>
          {professional && (
            <p className="text-xs text-muted-foreground mt-2 truncate pl-1">
              {professional.business_name}
            </p>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEM_DEFS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-tour-id={TOUR_IDS[item.href]}
              className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {t(item.tKey)}
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
              {t('viewPublicPage')} &rarr;
            </a>
          )}
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground w-full rounded-md hover:bg-accent transition-colors"
            >
              <LogOut className="h-4 w-4" />
              {t('logout')}
            </button>
          </form>
          <div className="flex items-center justify-between px-3 pt-2">
            <p className="text-[10px] text-muted-foreground/50">
              by CircleHood Tech
            </p>
            <LocaleSwitcher />
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex-1 flex flex-col">
        <header className="md:hidden border-b px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <CircleHoodLogoCompact size="xs" />
            <span className="text-sm font-bold">CircleHood Booking</span>
          </Link>
          <LocaleSwitcher />
        </header>

        {/* Mobile bottom nav */}
        <MobileNav professionalSlug={professional?.slug} />

        <GuidedTour />
        <main className="flex-1 p-4 sm:p-6 md:p-8 pb-20 md:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
