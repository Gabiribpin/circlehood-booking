import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { BookingsManager } from '@/components/dashboard/bookings-manager';

export default async function BookingsPage() {
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

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, services(name, price)')
    .eq('professional_id', professional.id)
    .order('booking_date', { ascending: false })
    .order('start_time', { ascending: false });

  return (
    <BookingsManager
      bookings={bookings || []}
      currency={professional.currency}
    />
  );
}
