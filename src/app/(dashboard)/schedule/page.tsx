import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ScheduleManager } from '@/components/dashboard/schedule-manager';

export default async function SchedulePage() {
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

  const { data: workingHours } = await supabase
    .from('working_hours')
    .select('*')
    .eq('professional_id', professional.id)
    .order('day_of_week', { ascending: true });

  const { data: blockedDates } = await supabase
    .from('blocked_dates')
    .select('*')
    .eq('professional_id', professional.id)
    .order('blocked_date', { ascending: true });

  return (
    <ScheduleManager
      workingHours={workingHours || []}
      blockedDates={blockedDates || []}
      professionalId={professional.id}
    />
  );
}
