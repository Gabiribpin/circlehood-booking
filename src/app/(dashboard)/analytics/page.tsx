import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
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
    .select('id, business_name, bio, phone')
    .eq('user_id', user.id)
    .single();

  if (!professional) {
    redirect('/onboarding');
  }

  return (
    <div className="container mx-auto py-6 px-4 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Insights and metrics for {professional.business_name}
        </p>
      </div>

      <AnalyticsDashboard professionalId={professional.id} />
    </div>
  );
}
