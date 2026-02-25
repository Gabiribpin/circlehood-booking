import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AnalyticsDashboard } from './analytics-dashboard';

export const metadata = {
  title: 'Analytics | CircleHood Booking',
  description: 'Analytics and insights for your business',
};

export default async function AnalyticsPage() {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get professional data
  const { data: professional } = await supabase
    .from('professionals')
    .select('id, business_name, currency')
    .eq('user_id', user.id)
    .single();

  if (!professional) {
    redirect('/onboarding');
  }

  const t = await getTranslations('analytics');

  return (
    <div className="container mx-auto py-6 px-4 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('subtitle', { name: professional.business_name })}
        </p>
      </div>

      <AnalyticsDashboard professionalId={professional.id} currency={professional.currency ?? 'BRL'} />
    </div>
  );
}
