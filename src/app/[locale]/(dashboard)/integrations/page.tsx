import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { IntegrationsManager } from './integrations-manager';

export default async function IntegrationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: professional } = await supabase
    .from('professionals')
    .select('id, business_name')
    .eq('user_id', user.id)
    .single();

  if (!professional) {
    redirect('/onboarding');
  }

  // Buscar integrações configuradas
  const { data: integrations } = await supabase
    .from('integrations')
    .select('*')
    .eq('professional_id', professional.id);

  return (
    <IntegrationsManager
      professional={professional}
      integrations={integrations || []}
    />
  );
}
