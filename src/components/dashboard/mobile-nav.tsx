'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  Palette,
  Scissors,
  Menu,
  Clock,
  UserCheck,
  QrCode,
  BarChart3,
  ImageIcon,
  MessageSquare,
  Settings,
  LogOut,
  LifeBuoy,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useState } from 'react';

interface MobileNavProps {
  professionalSlug?: string;
  failedNotificationsCount?: number;
}

// data-tour-id values for guided tour — only items visible in the bottom bar
const TOUR_IDS: Partial<Record<string, string>> = {
  '/my-page-editor': 'my-page',
  '/services': 'services',
};

export function MobileNav({ professionalSlug, failedNotificationsCount = 0 }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const t = useTranslations('nav');

  const MAIN_ITEMS = [
    { href: '/dashboard' as const, label: t('dashboard'), icon: LayoutDashboard },
    { href: '/bookings' as const, label: t('bookings'), icon: CalendarDays },
    { href: '/my-page-editor' as const, label: t('myPage'), icon: Palette },
    { href: '/services' as const, label: t('services'), icon: Scissors },
  ];

  const MENU_ITEMS = [
    { href: '/schedule' as const, label: t('schedule'), icon: Clock },
    { href: '/clients' as const, label: t('clients'), icon: UserCheck },
    { href: '/marketing' as const, label: t('marketing'), icon: QrCode },
    { href: '/analytics' as const, label: t('analytics'), icon: BarChart3 },
    { href: '/gallery' as const, label: t('gallery'), icon: ImageIcon },
    { href: '/testimonials' as const, label: t('testimonials'), icon: MessageSquare },
    { href: '/settings' as const, label: t('settings'), icon: Settings },
    { href: '/support' as const, label: t('support'), icon: LifeBuoy },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background z-50">
      <div className="flex justify-around py-2">
        {MAIN_ITEMS.map((item) => {
          const isActive = pathname.endsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour-id={TOUR_IDS[item.href]}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              } hover:text-foreground transition-colors`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}

        {/* Menu Sheet */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              className="flex flex-col items-center gap-0.5 px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
              suppressHydrationWarning
            >
              <Menu className="h-5 w-5" />
              <span className="text-[10px]">Menu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="flex flex-col max-h-[80vh]">
            <SheetHeader className="shrink-0">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            {/* Scrollable menu items */}
            <div className="flex-1 overflow-y-auto py-2 space-y-1">
              {MENU_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors"
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-sm">{item.label}</span>
                  {item.href === '/settings' && failedNotificationsCount > 0 && (
                    <span className="ml-auto text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                      {failedNotificationsCount > 99 ? '99+' : failedNotificationsCount}
                    </span>
                  )}
                </Link>
              ))}
            </div>
            {/* Fixed bottom: public page + logout — always visible */}
            <div className="shrink-0 border-t pt-2 pb-1 space-y-1">
              {professionalSlug && (
                <a
                  href={`/${professionalSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors text-muted-foreground text-sm"
                >
                  {t('viewPublicPage')} →
                </a>
              )}
              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors text-muted-foreground w-full text-left"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="text-sm">{t('logout')}</span>
                </button>
              </form>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
