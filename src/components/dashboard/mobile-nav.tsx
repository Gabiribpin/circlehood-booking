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
  FileEdit,
  ImageIcon,
  MessageSquare,
  Settings,
  LogOut,
  Phone,
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
}

// data-tour-id values for guided tour — only items visible in the bottom bar
const TOUR_IDS: Partial<Record<string, string>> = {
  '/my-page': 'my-page',
  '/services': 'services',
};

export function MobileNav({ professionalSlug }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const t = useTranslations('nav');

  const MAIN_ITEMS = [
    { href: '/dashboard' as const, label: t('dashboard'), icon: LayoutDashboard },
    { href: '/bookings' as const, label: t('bookings'), icon: CalendarDays },
    { href: '/my-page' as const, label: t('myPage'), icon: Palette },
    { href: '/services' as const, label: t('services'), icon: Scissors },
  ];

  const MENU_ITEMS = [
    { href: '/schedule' as const, label: t('schedule'), icon: Clock },
    { href: '/clients' as const, label: t('clients'), icon: UserCheck },
    { href: '/marketing' as const, label: t('marketing'), icon: QrCode },
    { href: '/analytics' as const, label: t('analytics'), icon: BarChart3 },
    { href: '/my-page-editor' as const, label: t('pageEditor'), icon: FileEdit },
    { href: '/gallery' as const, label: t('gallery'), icon: ImageIcon },
    { href: '/testimonials' as const, label: t('testimonials'), icon: MessageSquare },
    { href: '/whatsapp-config' as const, label: t('whatsapp'), icon: Phone },
    { href: '/settings' as const, label: t('settings'), icon: Settings },
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
          <SheetContent side="bottom" className="h-auto">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="py-4 space-y-2">
              {MENU_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors"
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-sm">{item.label}</span>
                </Link>
              ))}

              <div className="pt-2 border-t">
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
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
