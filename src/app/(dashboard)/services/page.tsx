import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ServicesManager } from '@/components/dashboard/services-manager';

export default async function ServicesPage() {
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

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('professional_id', professional.id)
    .order('sort_order', { ascending: true });

  return (
    <ServicesManager
      services={services || []}
      professionalId={professional.id}
      currency={professional.currency}
      businessName={professional.business_name}
      category={professional.category}
    />
  );
}
