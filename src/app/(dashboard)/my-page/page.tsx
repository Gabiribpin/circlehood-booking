import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MyPageEditor } from '@/components/dashboard/my-page-editor';
import { QrCodeDownload } from '@/components/dashboard/qr-code-download';

export default async function MyPageEditorPage() {
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
    <div>
      <QrCodeDownload slug={professional.slug} businessName={professional.business_name} />
      <MyPageEditor
        professional={professional}
        services={services || []}
      />
    </div>
  );
}
