import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MyPageEditor } from '@/components/dashboard/my-page-editor';

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
    <MyPageEditor
      professional={professional}
      services={services || []}
    />
  );
}
