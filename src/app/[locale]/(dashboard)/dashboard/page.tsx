import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
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
import { ShareLinkCard } from '@/components/dashboard/share-link-card';
import { AlertsWidget } from './components/alerts-widget';
import { WhatsAppUsageWidget } from '@/components/whatsapp/usage-widget';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: professional } = await supabase
    .from('professionals')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!professional) redirect('/register');

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
  const currencySymbol = currencySymbols[professional.currency as string] ?? professional.currency ?? 'R$';

  const trialDaysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(professional.trial_ends_at).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    )
  );

  const showOnboardingBanner = !professional.onboarding_completed;

  // Setup checklist — itens obrigatórios e opcionais
  const setupRequired = [
    {
      id: 'phone',
      label: 'Adicionar telefone de contato',
      done: !!(professional.phone),
      href: '/settings',
    },
    {
      id: 'services',
      label: 'Adicionar pelo menos 1 serviço',
      done: (totalServices ?? 0) > 0,
      href: '/services',
    },
    {
      id: 'schedule',
      label: 'Definir horários de atendimento',
      done: (workingHoursCount ?? 0) > 0,
      href: '/schedule',
    },
    {
      id: 'whatsapp',
      label: 'Configurar WhatsApp Bot',
      done: whatsappConfig?.is_active === true,
      href: '/whatsapp-config',
    },
  ];

  const setupOptional = [
    {
      id: 'page',
      label: 'Personalizar página pública',
      done: !!(professional.bio && (professional.bio as string).length > 10),
      href: '/my-page-editor',
    },
    {
      id: 'gallery',
      label: 'Adicionar fotos à galeria',
      done: (galleryCount ?? 0) > 0,
      href: '/gallery',
    },
    {
      id: 'testimonials',
      label: 'Adicionar depoimentos',
      done: (testimonialsCount ?? 0) > 0,
      href: '/testimonials',
    },
  ];

  const requiredDone = setupRequired.filter((s) => s.done).length;
  const allRequiredDone = requiredDone === setupRequired.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 data-testid="dashboard-welcome" className="text-2xl font-bold">
            Ola, {professional.business_name}!
          </h1>
          {professional.subscription_status === 'trial' && (
            <p className="text-sm text-muted-foreground mt-1">
              Período de teste: {trialDaysLeft} dias restantes
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
              Ver minha página
            </a>
          </Button>
        </div>
      </div>

      {/* Checklist de setup — visível enquanto não concluiu onboarding */}
      {showOnboardingBanner && (
        <Card data-testid="onboarding-banner" className="border-primary/30">
          <CardContent className="p-5">
            {/* Header + progresso */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-sm">
                  {allRequiredDone ? '🎉 Conta pronta para receber clientes!' : 'Configure sua conta'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {requiredDone} de {setupRequired.length} etapas obrigatórias concluídas
                </p>
              </div>
              {allRequiredDone && (
                <Button asChild size="sm" variant="outline">
                  <Link href="/onboarding">Concluir setup</Link>
                </Button>
              )}
            </div>

            {/* Barra de progresso */}
            <div className="w-full bg-muted rounded-full h-1.5 mb-4">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((requiredDone / setupRequired.length) * 100)}%` }}
              />
            </div>

            {/* Itens obrigatórios */}
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

            {/* Itens opcionais — colapsados visualmente */}
            <details className="group">
              <summary className="text-xs text-muted-foreground cursor-pointer select-none list-none flex items-center gap-1 mb-2">
                <ChevronRight className="h-3 w-3 group-open:rotate-90 transition-transform" />
                Opcional ({setupOptional.filter((s) => s.done).length}/{setupOptional.length} concluídos)
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

      {/* Alertas CRM */}
      <AlertsWidget />

      {/* Widget de uso WhatsApp */}
      <WhatsAppUsageWidget />

      {/* Stats */}
      <div className="space-y-4">
        {/* Bookings Stats */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Agendamentos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <CalendarDays className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Hoje</p>
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
                    <p className="text-xs text-muted-foreground">Semana</p>
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
                    <p className="text-xs text-muted-foreground">Mês</p>
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
                    <p className="text-xs text-muted-foreground">Serviços</p>
                    <p className="text-2xl font-bold">{totalServices || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Revenue Stats */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Receita</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Hoje</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {currencySymbol}{todayRevenueTotal.toFixed(0)}
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
                    <p className="text-xs text-muted-foreground">Semana</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {currencySymbol}{weekRevenueTotal.toFixed(0)}
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
                    <p className="text-xs text-muted-foreground">Mês</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {currencySymbol}{monthRevenueTotal.toFixed(0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Status badge */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <span className="text-sm font-medium">Status da assinatura</span>
          <Badge variant="secondary">
            {professional.subscription_status === 'trial'
              ? `Teste grátis (${trialDaysLeft}d)`
              : professional.subscription_status === 'active'
                ? 'Ativo'
                : 'Expirado'}
          </Badge>
        </CardContent>
      </Card>

      {/* Today's bookings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Agendamentos de hoje</CardTitle>
        </CardHeader>
        <CardContent>
          {!todayUpcoming || todayUpcoming.length === 0 ? (
            <div className="text-center py-8">
              <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                Nenhum agendamento para hoje.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Compartilhe sua página para receber agendamentos!
              </p>
              <Button asChild variant="outline" className="mt-4" size="sm">
                <Link href="/services">Adicionar serviços</Link>
              </Button>
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
                      Gerenciar
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Share link with QR code */}
      <ShareLinkCard
        slug={professional.slug}
        businessName={professional.business_name}
      />
    </div>
  );
}
