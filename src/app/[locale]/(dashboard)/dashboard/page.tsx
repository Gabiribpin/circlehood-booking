import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CalendarDays,
  TrendingUp,
  Users,
  ExternalLink,
  CalendarRange,
  CheckCircle2,
  Circle,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

import { AlertsWidget } from './components/alerts-widget';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: professional } = await supabase
    .from('professionals')
    .select('id, business_name, slug, bio, currency, subscription_status, trial_ends_at, onboarding_completed, phone')
    .eq('user_id', user.id)
    .single();

  if (!professional) redirect('/onboarding');

  const t = await getTranslations('dashboard');

  const today = new Date().toISOString().split('T')[0];

  // Week range (Monday to Sunday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekStart = monday.toISOString().split('T')[0];
  const weekEnd = sunday.toISOString().split('T')[0];

  // Month range
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthEnd = nextMonth.toISOString().split('T')[0];

  // Parallel queries
  const [
    { count: todayBookings },
    { count: weekBookings },
    { count: monthBookings },
    { count: totalServices },
    { data: todayUpcoming },
    { count: workingHoursCount },
    { data: todayRevenue },
    { data: weekRevenue },
    { data: monthRevenue },
    { data: whatsappConfig },
    { count: galleryCount },
    { count: testimonialsCount },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('professional_id', professional.id)
      .eq('booking_date', today)
      .eq('status', 'confirmed'),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('professional_id', professional.id)
      .gte('booking_date', weekStart)
      .lte('booking_date', weekEnd)
      .eq('status', 'confirmed'),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('professional_id', professional.id)
      .gte('booking_date', monthStart)
      .lte('booking_date', monthEnd)
      .eq('status', 'confirmed'),
    supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('professional_id', professional.id)
      .eq('is_active', true),
    supabase
      .from('bookings')
      .select('*, services(name, price)')
      .eq('professional_id', professional.id)
      .eq('booking_date', today)
      .eq('status', 'confirmed')
      .order('start_time', { ascending: true }),
    supabase
      .from('working_hours')
      .select('*', { count: 'exact', head: true })
      .eq('professional_id', professional.id)
      .eq('is_available', true),
    supabase
      .from('bookings')
      .select('services(price)')
      .eq('professional_id', professional.id)
      .eq('booking_date', today)
      .eq('status', 'confirmed'),
    supabase
      .from('bookings')
      .select('services(price)')
      .eq('professional_id', professional.id)
      .gte('booking_date', weekStart)
      .lte('booking_date', weekEnd)
      .eq('status', 'confirmed'),
    supabase
      .from('bookings')
      .select('services(price)')
      .eq('professional_id', professional.id)
      .gte('booking_date', monthStart)
      .lte('booking_date', monthEnd)
      .eq('status', 'confirmed'),
    supabase
      .from('whatsapp_config')
      .select('is_active')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('gallery_images')
      .select('*', { count: 'exact', head: true })
      .eq('professional_id', professional.id),
    supabase
      .from('testimonials')
      .select('*', { count: 'exact', head: true })
      .eq('professional_id', professional.id),
  ]);

  // Calculate revenue
  const calculateRevenue = (data: any[] | null) => {
    if (!data) return 0;
    return data.reduce((sum, booking) => {
      const price = (booking.services as { price: number } | null)?.price || 0;
      return sum + price;
    }, 0);
  };

  const todayRevenueTotal = calculateRevenue(todayRevenue);
  const weekRevenueTotal = calculateRevenue(weekRevenue);
  const monthRevenueTotal = calculateRevenue(monthRevenue);

  const currencySymbols: Record<string, string> = { EUR: '€', GBP: '£', USD: '$', BRL: 'R$' };
  const currencySymbol = currencySymbols[(professional.currency as string)?.toUpperCase()] ?? professional.currency ?? 'R$';

  const trialDaysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(professional.trial_ends_at).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    )
  );

  const showOnboardingBanner = !professional.onboarding_completed;

  // Setup checklist
  const setupRequired = [
    { id: 'phone',     label: t('setupPhone'),      done: !!(professional.phone),                href: '/settings' },
    { id: 'services',  label: t('setupServices'),   done: (totalServices ?? 0) > 0,              href: '/services' },
    { id: 'schedule',  label: t('setupSchedule'),   done: (workingHoursCount ?? 0) > 0,          href: '/schedule' },
    { id: 'whatsapp',  label: t('setupWhatsapp'),   done: whatsappConfig?.is_active === true,    href: '/settings?tab=whatsapp' },
  ];

  const setupOptional = [
    { id: 'page',         label: t('setupPage'),         done: !!(professional.bio && (professional.bio as string).length > 10), href: '/my-page-editor' },
    { id: 'gallery',      label: t('setupGallery'),      done: (galleryCount ?? 0) > 0,                                          href: '/gallery' },
    { id: 'testimonials', label: t('setupTestimonials'), done: (testimonialsCount ?? 0) > 0,                                     href: '/testimonials' },
  ];

  const requiredDone = setupRequired.filter((s) => s.done).length;
  const allRequiredDone = requiredDone === setupRequired.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 data-testid="dashboard-welcome" className="text-2xl font-bold">
            {t('greeting', { name: professional.business_name })}
          </h1>
          {professional.subscription_status === 'trial' && (
            <p className="text-sm text-muted-foreground mt-1">
              {t('trialDaysLeft', { days: trialDaysLeft })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a
              href={`/${professional.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
              {t('viewMyPage')}
            </a>
          </Button>
        </div>
      </div>

      {/* Setup checklist */}
      {showOnboardingBanner && (
        <Card data-testid="onboarding-banner" className="border-primary/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-sm">
                  {allRequiredDone ? t('allDoneMessage') : t('configureAccount')}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('setupProgress', { done: requiredDone, total: setupRequired.length })}
                </p>
              </div>
              {allRequiredDone && (
                <Button asChild size="sm" variant="outline">
                  <Link href="/onboarding">{t('finishSetup')}</Link>
                </Button>
              )}
            </div>

            <div className="w-full bg-muted rounded-full h-1.5 mb-4">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((requiredDone / setupRequired.length) * 100)}%` }}
              />
            </div>

            <div className="space-y-1.5 mb-4">
              {setupRequired.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-2.5 group rounded-md px-1 py-1 hover:bg-accent transition-colors"
                >
                  {item.done ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className={`text-xs flex-1 ${item.done ? 'text-muted-foreground line-through' : 'font-medium'}`}>
                    {item.label}
                  </span>
                  {!item.done && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  )}
                </Link>
              ))}
            </div>

            <details className="group">
              <summary className="text-xs text-muted-foreground cursor-pointer select-none list-none flex items-center gap-1 mb-2">
                <ChevronRight className="h-3 w-3 group-open:rotate-90 transition-transform" />
                {t('optionalSetup', { done: setupOptional.filter((s) => s.done).length, total: setupOptional.length })}
              </summary>
              <div className="space-y-1 pl-1">
                {setupOptional.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-center gap-2.5 group/item rounded-md px-1 py-0.5 hover:bg-accent transition-colors"
                  >
                    {item.done ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    )}
                    <span className={`text-xs flex-1 ${item.done ? 'text-muted-foreground/60 line-through' : 'text-muted-foreground'}`}>
                      {item.label}
                    </span>
                  </Link>
                ))}
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      {/* CRM Alerts */}
      <AlertsWidget />

      {/* Stats — only show when there's data */}
      {((todayBookings ?? 0) > 0 || (weekBookings ?? 0) > 0 || (monthBookings ?? 0) > 0) && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">{t('statsSectionBookings')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <CalendarDays className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('statsTodayLabel')}</p>
                      <p className="text-2xl font-bold">{todayBookings || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <CalendarRange className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('statsWeekLabel')}</p>
                      <p className="text-2xl font-bold">{weekBookings || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('statsMonthLabel')}</p>
                      <p className="text-2xl font-bold">{monthBookings || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('statsServicesLabel')}</p>
                      <p className="text-2xl font-bold">{totalServices || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {(todayRevenueTotal > 0 || weekRevenueTotal > 0 || monthRevenueTotal > 0) && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-3">{t('statsSectionRevenue')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                        <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('statsTodayLabel')}</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {currencySymbol}{todayRevenueTotal.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                        <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('statsWeekLabel')}</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {currencySymbol}{weekRevenueTotal.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                        <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('statsMonthLabel')}</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {currencySymbol}{monthRevenueTotal.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subscription status badge */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <span className="text-sm font-medium">{t('subscriptionStatus')}</span>
          <Badge variant="secondary">
            {professional.subscription_status === 'trial'
              ? t('subscriptionTrial', { days: trialDaysLeft })
              : professional.subscription_status === 'active'
                ? t('subscriptionActive')
                : t('subscriptionExpired')}
          </Badge>
        </CardContent>
      </Card>

      {/* Today's bookings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('todayBookingsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {!todayUpcoming || todayUpcoming.length === 0 ? (
            <div className="text-center py-8">
              <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{t('noBookingsToday')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('sharePageHint')}</p>
              {(totalServices ?? 0) > 0 ? (
                <Button asChild variant="outline" className="mt-4" size="sm">
                  <a
                    href={`/${professional.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    {t('shareYourLink')}
                  </a>
                </Button>
              ) : (
                <Button asChild variant="outline" className="mt-4" size="sm">
                  <Link href="/services">{t('addServices')}</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {todayUpcoming.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{booking.client_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(booking.services as { name: string } | null)?.name}{' '}
                      &mdash; {booking.start_time.slice(0, 5)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {booking.client_phone && (
                      <a
                        href={`https://wa.me/${booking.client_phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        WhatsApp
                      </a>
                    )}
                    <Link
                      href="/bookings"
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      {t('manage')}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
