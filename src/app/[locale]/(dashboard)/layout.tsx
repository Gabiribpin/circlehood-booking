import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { MobileNav } from '@/components/dashboard/mobile-nav';
import { CircleHoodLogoCompact } from '@/components/branding/logo';
import { GuidedTour } from '@/components/onboarding/guided-tour';
import { EmailVerificationBanner } from '@/components/dashboard/email-verification-banner';
import { TrialExpirationBanner } from '@/components/dashboard/trial-expiration-banner';
import { getTrialStatus } from '@/lib/trial-helpers';
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
  { href: '/notifications', tKey: 'notifications', icon: Bell },
  { href: '/whatsapp-config', tKey: 'whatsapp', icon: Phone },
  { href: '/my-page-editor', tKey: 'pageEditor', icon: FileEdit },
  { href: '/gallery', tKey: 'gallery', icon: ImageIcon },
  { href: '/testimonials', tKey: 'testimonials', icon: MessageSquare },
  { href: '/my-page', tKey: 'myPage', icon: Palette },
  { href: '/settings', tKey: 'settings', icon: Settings },
  { href: '/support', tKey: 'support', icon: LifeBuoy },
] as const;

// Automações removida do nav intencionalmente (rota ainda existe)

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
    .select('*')
    .eq('user_id', user.id)
    .single();

  // Block dashboard access if email not verified yet
  if (professional && professional.email_verified === false) {
    redirect('/verify-email-pending');
  }

  // Trial status for banner
  const trialStatus = user ? await getTrialStatus(user.id) : null;

  // Badge: contagem de notificações com falha nos últimos 30 dias
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: failedNotificationsCount } = professional
    ? await supabase
        .from('notification_logs')
        .select('*', { count: 'exact', head: true })
        .eq('professional_id', professional.id)
        .eq('status', 'failed')
        .gte('created_at', since30d)
    : { count: 0 };
  const failedCount = failedNotificationsCount ?? 0;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-muted/30 h-screen sticky top-0">
        <div className="p-4 pb-3 shrink-0">
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

        <nav className="flex-1 overflow-y-auto px-3 space-y-1 py-1">
          {NAV_ITEM_DEFS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-tour-id={TOUR_IDS[item.href]}
              className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {t(item.tKey)}
              {item.href === '/notifications' && failedCount > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                  {failedCount > 99 ? '99+' : failedCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="shrink-0 p-3 border-t">
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
          <div className="px-3 pt-2">
            <p className="text-[10px] text-muted-foreground/50">
              by CircleHood Tech
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex-1 flex flex-col">
        <header className="md:hidden border-b px-4 py-3 flex items-center">
          <Link href="/dashboard" className="flex items-center gap-2">
            <CircleHoodLogoCompact size="xs" />
            <span className="text-sm font-bold">CircleHood Booking</span>
          </Link>
        </header>

        {/* Mobile bottom nav */}
        <MobileNav professionalSlug={professional?.slug} failedNotificationsCount={failedCount} />

        <GuidedTour />

        {/* Email verification banner — shown if email_verified=false (shouldn't reach here due to redirect, but safety net) */}
        {professional?.email_verified === false && user.email && (
          <div className="px-4 pt-3">
            <EmailVerificationBanner userEmail={user.email} />
          </div>
        )}

        {/* Trial expiration banner — shown when ≤7 days remain */}
        {trialStatus?.isTrialActive && trialStatus.daysRemaining <= 7 && trialStatus.trialEndsAt && (
          <div className="px-4 pt-3">
            <TrialExpirationBanner
              daysRemaining={trialStatus.daysRemaining}
              trialEndsAt={trialStatus.trialEndsAt.toISOString()}
            />
          </div>
        )}

        {/* Deletion pending banner */}
        {professional?.deleted_at && professional?.deletion_scheduled_for && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-yellow-800">
              ⚠️ {t('deletionBanner', {
                date: new Date(professional.deletion_scheduled_for).toLocaleDateString('pt-BR'),
              })}
            </p>
            <form action="/api/account/cancel-deletion" method="POST">
              <button
                type="submit"
                className="text-xs text-yellow-900 underline hover:no-underline whitespace-nowrap"
              >
                {t('cancelDeletion')}
              </button>
            </form>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 md:p-8 pb-20 md:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
