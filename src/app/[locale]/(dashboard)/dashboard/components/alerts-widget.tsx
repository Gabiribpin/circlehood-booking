'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

interface AlertItem {
  icon: string;
  title: string;
  description: string;
  count: number;
  color: string;
  bgColor: string;
  badgeLabel: string;
  badgeColor: string;
  href: string;
}

export function AlertsWidget() {
  const router = useRouter();
  const t = useTranslations('alerts');
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, []);

  async function loadAlerts() {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!professional) return;

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // 1. Lembretes pendentes (bookings confirmados para amanhã sem lembrete enviado)
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { count: remindersCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('professional_id', professional.id)
      .eq('booking_date', tomorrowStr)
      .eq('status', 'confirmed');

    // 2. Clientes inativos (último booking confirmado há >60 dias)
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split('T')[0];

    const { data: allContacts } = await supabase
      .from('contacts')
      .select('phone')
      .eq('professional_id', professional.id);

    const { data: recentBookings } = await supabase
      .from('bookings')
      .select('client_phone')
      .eq('professional_id', professional.id)
      .eq('status', 'confirmed')
      .gte('booking_date', sixtyDaysAgoStr);

    const recentPhones = new Set(
      (recentBookings || []).map((b) => b.client_phone?.replace(/\D/g, ''))
    );

    const inactiveCount = (allContacts || []).filter((c) => {
      const phone = c.phone?.replace(/\D/g, '');
      return phone && !recentPhones.has(phone);
    }).length;

    // 3. Lista de espera (bookings com status 'waitlist')
    const { count: waitlistCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('professional_id', professional.id)
      .eq('status', 'waitlist');

    // 4. Aniversariantes do mês (contacts com birthday no mês atual)
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const { data: contactsWithBirthday } = await supabase
      .from('contacts')
      .select('birthday')
      .eq('professional_id', professional.id)
      .not('birthday', 'is', null);

    const birthdayCount = (contactsWithBirthday || []).filter((c) => {
      if (!c.birthday) return false;
      const month = c.birthday.slice(5, 7); // "YYYY-MM-DD" → "MM"
      return month === currentMonth;
    }).length;

    const alertItems: AlertItem[] = [
      {
        icon: '🎂',
        title: birthdayCount
          ? t('birthdayTitle', { count: birthdayCount })
          : t('birthdayNone'),
        description: birthdayCount ? t('birthdayDesc') : t('birthdayDescNone'),
        count: birthdayCount || 0,
        color: 'text-purple-700',
        bgColor: 'bg-purple-50',
        badgeLabel: t('birthdayBadge'),
        badgeColor: 'bg-purple-600 text-white hover:bg-purple-700',
        href: '/clients?filter=birthday',
      },
      {
        icon: '⏰',
        title: remindersCount
          ? t('reminderTitle', { count: remindersCount })
          : t('reminderNone'),
        description: remindersCount ? t('reminderDesc') : t('reminderDescNone'),
        count: remindersCount || 0,
        color: 'text-blue-700',
        bgColor: 'bg-blue-50',
        badgeLabel: t('reminderBadge'),
        badgeColor: 'border border-blue-300 text-blue-700',
        href: '/bookings',
      },
      {
        icon: '⚠️',
        title: inactiveCount
          ? t('inactiveTitle', { count: inactiveCount })
          : t('inactiveNone'),
        description: inactiveCount ? t('inactiveDesc') : t('inactiveDescNone'),
        count: inactiveCount,
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-50',
        badgeLabel: t('inactiveBadge'),
        badgeColor: 'bg-yellow-500 text-white hover:bg-yellow-600',
        href: '/clients?filter=inactive',
      },
      {
        icon: '📝',
        title: waitlistCount
          ? t('waitlistTitle', { count: waitlistCount })
          : t('waitlistNone'),
        description: waitlistCount ? t('waitlistDesc') : t('waitlistDescNone'),
        count: waitlistCount || 0,
        color: 'text-green-700',
        bgColor: 'bg-green-50',
        badgeLabel: t('waitlistBadge'),
        badgeColor: 'bg-green-600 text-white hover:bg-green-700',
        href: '/bookings',
      },
    ];

    setAlerts(alertItems);
    setLoading(false);
  }

  if (loading) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">{t('title')}</h2>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  const activeAlerts = alerts.filter((a) => a.count > 0);
  const hasAlerts = activeAlerts.length > 0;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        {hasAlerts && (
          <Badge className="bg-red-500 text-white text-xs">
            {t('newBadge', { count: activeAlerts.length })}
          </Badge>
        )}
      </div>

      {!hasAlerts ? (
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-sm">{t('allGood')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.title}
              onClick={() => router.push(alert.href)}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-opacity hover:opacity-80 ${alert.bgColor} ${alert.count === 0 ? 'opacity-40' : ''}`}
            >
              <span className="text-2xl flex-shrink-0">{alert.icon}</span>

              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm ${alert.color}`}>
                  {alert.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {alert.description}
                </p>
              </div>

              {alert.count > 0 && (
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${alert.badgeColor}`}
                >
                  {alert.badgeLabel}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
