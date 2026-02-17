'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  Palette,
  Scissors,
  Menu,
  Clock,
  Users,
  Megaphone,
  QrCode,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface MobileNavProps {
  professionalSlug?: string;
}

const MAIN_ITEMS = [
  { href: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { href: '/bookings', label: 'Agendamentos', icon: CalendarDays },
  { href: '/my-page', label: 'Minha Página', icon: Palette },
  { href: '/services', label: 'Serviços', icon: Scissors },
];

const MENU_ITEMS = [
  { href: '/schedule', label: 'Horários', icon: Clock },
  { href: '/contacts', label: 'Contatos', icon: Users },
  { href: '/campaigns', label: 'Campanhas', icon: Megaphone },
  { href: '/marketing', label: 'Marketing', icon: QrCode },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Configurações', icon: Settings },
];

export function MobileNav({ professionalSlug }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background z-50">
      <div className="flex justify-around py-2">
        {MAIN_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
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
            <button className="flex flex-col items-center gap-0.5 px-2 py-1 text-muted-foreground hover:text-foreground transition-colors">
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
                    Ver minha página pública →
                  </a>
                )}
                <form action="/api/auth/signout" method="POST">
                  <button
                    type="submit"
                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors text-muted-foreground w-full text-left"
                  >
                    <LogOut className="h-5 w-5" />
                    <span className="text-sm">Sair</span>
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
