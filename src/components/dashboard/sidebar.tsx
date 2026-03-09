'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { CircleHoodLogoCompact } from '@/components/branding/logo';
import {
  LayoutDashboard,
  Scissors,
  CalendarDays,
  Clock,
  Users,
  QrCode,
  BarChart3,
  Bell,
  Phone,
  Palette,
  ImageIcon,
  MessageSquare,
  Settings,
  LifeBuoy,
  LogOut,
} from 'lucide-react';

// Tour IDs for guided tour — keyed by nav href
const TOUR_IDS: Partial<Record<string, string>> = {
  '/services': 'services',
  '/schedule': 'schedule',
  '/whatsapp-config': 'whatsapp',
  '/my-page-editor': 'my-page',
};

const NAV_GROUPS = [
  {
    tKey: 'groupMain' as const,
    items: [
      { href: '/dashboard', tKey: 'dashboard' as const, icon: LayoutDashboard },
      { href: '/bookings', tKey: 'bookings' as const, icon: CalendarDays },
      { href: '/services', tKey: 'services' as const, icon: Scissors },
      { href: '/schedule', tKey: 'schedule' as const, icon: Clock },
      { href: '/clients', tKey: 'clients' as const, icon: Users },
    ],
  },
  {
    tKey: 'groupPage' as const,
    items: [
      { href: '/my-page-editor', tKey: 'myPage' as const, icon: Palette },
      { href: '/gallery', tKey: 'gallery' as const, icon: ImageIcon },
      { href: '/testimonials', tKey: 'testimonials' as const, icon: MessageSquare },
    ],
  },
  {
    tKey: 'groupCommunication' as const,
    items: [
      { href: '/whatsapp-config', tKey: 'whatsapp' as const, icon: Phone },
      { href: '/notifications', tKey: 'notifications' as const, icon: Bell },
    ],
  },
  {
    tKey: 'groupGrowth' as const,
    items: [
      { href: '/marketing', tKey: 'marketing' as const, icon: QrCode },
      { href: '/analytics', tKey: 'analytics' as const, icon: BarChart3 },
    ],
  },
  {
    tKey: 'groupAccount' as const,
    items: [
      { href: '/settings', tKey: 'settings' as const, icon: Settings },
      { href: '/support', tKey: 'support' as const, icon: LifeBuoy },
    ],
  },
];

interface SidebarProps {
  professionalSlug?: string;
  businessName?: string;
  userEmail?: string;
  failedNotificationsCount: number;
}

export function Sidebar({
  professionalSlug,
  businessName,
  userEmail,
  failedNotificationsCount,
}: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('nav');

  function isActive(href: string) {
    // Strip locale prefix if present (e.g. /pt-BR/dashboard → /dashboard)
    const clean = pathname.replace(/^\/[a-z]{2}-[A-Z]{2}/, '');
    return clean === href || clean.startsWith(href + '/');
  }

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-muted/30 h-screen sticky top-0">
      <div className="p-4 pb-3 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2">
          <CircleHoodLogoCompact size="sm" />
          <span className="text-sm font-bold leading-tight">
            CircleHood<br />
            <span className="text-xs font-normal text-muted-foreground">Booking</span>
          </span>
        </Link>
        {businessName && (
          <p className="text-xs text-muted-foreground mt-2 truncate pl-1">
            {businessName}
          </p>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.tKey} className="mb-3">
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {t(group.tKey)}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-tour-id={TOUR_IDS[item.href]}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors',
                      active
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <item.icon className={cn('h-4 w-4', active && 'text-primary')} />
                    {t(item.tKey)}
                    {item.href === '/notifications' && failedNotificationsCount > 0 && (
                      <span className="ml-auto text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                        {failedNotificationsCount > 99 ? '99+' : failedNotificationsCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 p-3 border-t">
        {professionalSlug && (
          <a
            href={`/${professionalSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('viewPublicPage')} &rarr;
          </a>
        )}
        {userEmail && (
          <p className="px-3 py-1 text-[11px] text-muted-foreground truncate" title={userEmail}>
            {userEmail}
          </p>
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
        <div className="px-3 pt-2">
          <p className="text-[10px] text-muted-foreground/50">
            by CircleHood Tech
          </p>
        </div>
      </div>
    </aside>
  );
}
