import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getPlanPrice } from '@/lib/pricing';
import { UnifiedSettings } from './unified-settings';
import type { Professional } from '@/types/database';

interface PageProps {
  searchParams: Promise<{ success?: string; cancelled?: string; tab?: string; connect?: string }>;
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // 1. Fetch professional (sequential — needed for parallel queries)
  const { data: professional } = await supabase
    .from('professionals')
    .select('id, business_name, slug, locale, subscription_status, trial_ends_at, stripe_customer_id, account_number, created_at, currency, payment_method, manual_payment_key, payment_country, require_deposit, deposit_type, deposit_value')
    .eq('user_id', user.id)
    .single();

  if (!professional) redirect('/onboarding');

  // 2. Parallel fetch for all tabs
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: connectAccount },
    { data: whatsappConfig },
    { data: aiData },
    { data: bcData },
    { data: notificationLogs },
  ] = await Promise.all([
    supabase
      .from('stripe_connect_accounts')
      .select('charges_enabled')
      .eq('professional_id', professional.id)
      .maybeSingle(),
    supabase
      .from('whatsapp_config')
      .select('business_phone, evolution_instance, is_active')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('ai_instructions')
      .select('instructions')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('bot_config')
      .select('greeting_message')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('notification_logs')
      .select('id, channel, type, recipient, message, status, error_message, booking_id, created_at')
      .eq('professional_id', professional.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const trialDaysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(professional.trial_ends_at).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    )
  );

  const trialExpired =
    professional.subscription_status === 'trial' &&
    new Date(professional.trial_ends_at) < new Date();

  const params = await searchParams;
  const planPrice = getPlanPrice(professional.currency ?? 'eur');
  const headersList = await headers();
  const host = headersList.get('host') ?? 'booking.circlehood-tech.com';

  return (
    <UnifiedSettings
      professional={{ ...professional, subscription_status: professional.subscription_status as Professional['subscription_status'] }}
      trialDaysLeft={trialDaysLeft}
      trialExpired={trialExpired}
      success={params.success === 'true'}
      cancelled={params.cancelled === 'true'}
      planPrice={planPrice}
      host={host}
      whatsappInitialConfig={{
        phone: whatsappConfig?.business_phone ?? '',
        instanceName: whatsappConfig?.evolution_instance ?? '',
        isActive: whatsappConfig?.is_active ?? false,
      }}
      aiInitialConfig={{
        instructions: aiData?.instructions ?? '',
        greetingMessage: bcData?.greeting_message ?? '',
        businessName: professional.business_name ?? '',
      }}
      stripeConnected={connectAccount?.charges_enabled === true}
      notificationLogs={notificationLogs || []}
    />
  );
}
