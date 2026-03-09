import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { WhatsAppConfigClient } from './whatsapp-config-client';

export default async function WhatsAppConfigPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: professional } = await supabase
    .from('professionals')
    .select('id, business_name')
    .eq('user_id', user.id)
    .single();

  if (!professional) redirect('/onboarding');

  // Pre-fetch existing config to avoid client-side loading flash
  const [{ data: whatsappConfig }, { data: aiData }, { data: bcData }] = await Promise.all([
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
  ]);

  return (
    <WhatsAppConfigClient
      initialConfig={{
        phone: whatsappConfig?.business_phone ?? '',
        instanceName: whatsappConfig?.evolution_instance ?? '',
        isActive: whatsappConfig?.is_active ?? false,
        instructions: aiData?.instructions ?? '',
        greetingMessage: bcData?.greeting_message ?? '',
        businessName: professional.business_name ?? '',
      }}
    />
  );
}
