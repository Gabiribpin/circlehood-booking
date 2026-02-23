import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MarketingManager } from './marketing-manager';

export default async function MarketingPage() {
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

  // Fetch saved QR codes
  const { data: savedQRCodes } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('professional_id', professional.id)
    .order('created_at', { ascending: false });

  // Fetch QR scan stats
  const { count: totalScans } = await supabase
    .from('qr_scans')
    .select('*', { count: 'exact', head: true })
    .eq('professional_id', professional.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Marketing</h1>
        <p className="text-muted-foreground mt-1">
          Crie materiais de divulgação profissionais para seu negócio
        </p>
      </div>

      <MarketingManager
        professional={professional}
        savedQRCodes={savedQRCodes || []}
        totalScans={totalScans || 0}
      />
    </div>
  );
}
