import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { SettingsManager } from '@/components/dashboard/settings-manager';

interface PageProps {
  searchParams: Promise<{ success?: string; cancelled?: string }>;
}

export default async function SettingsPage({ searchParams }: PageProps) {
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

  return (
    <SettingsManager
      professional={professional}
      trialDaysLeft={trialDaysLeft}
      trialExpired={trialExpired}
      success={params.success === 'true'}
      cancelled={params.cancelled === 'true'}
    />
  );
}
