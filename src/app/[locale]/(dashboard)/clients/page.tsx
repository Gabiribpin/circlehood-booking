import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ClientsPageClient } from './clients-client';

export default async function ClientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!professional) redirect('/register');

  return <ClientsPageClient professionalId={professional.id} />;
}
