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
  Euro,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ShareLinkCard } from '@/components/dashboard/share-link-card';
import { AlertsWidget } from './components/alerts-widget';
import { RegionBroadcast } from '@/components/dashboard/region-broadcast';

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

  const trialDaysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(professional.trial_ends_at).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    )
  );

  const showOnboardingBanner = !professional.onboarding_completed;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Ola, {professional.business_name}!
          </h1>
          {professional.subscription_status === 'trial' && (
            <p className="text-sm text-muted-foreground mt-1">
              Período de teste: {trialDaysLeft} dias restantes
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <RegionBroadcast />
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

      {/* Banner de setup — aparece enquanto não concluiu onboarding */}
      {showOnboardingBanner && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <Info className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm">Configure sua conta para receber clientes</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Adicione serviços, horários e conecte o WhatsApp Bot.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/onboarding">Completar setup →</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Link de retorno ao guia (sempre visível, mas discreto) */}
      {!showOnboardingBanner && (
        <Card className="border-dashed">
          <CardContent className="p-4 flex items-center gap-3">
            <Info className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground flex-1">Precisa rever o guia de configuração?</p>
            <Button asChild variant="ghost" size="sm">
              <Link href="/onboarding">Ver guia</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Alertas CRM */}
      <AlertsWidget />

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
                    <Euro className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Hoje</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      €{todayRevenueTotal.toFixed(0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                    <Euro className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Semana</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      €{weekRevenueTotal.toFixed(0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                    <Euro className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Mês</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      €{monthRevenueTotal.toFixed(0)}
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
