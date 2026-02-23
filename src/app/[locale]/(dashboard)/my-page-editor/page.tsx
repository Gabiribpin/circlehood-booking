import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PageEditor } from './page-editor';

export const metadata = {
  title: 'Editor de Página | CircleHood Booking',
  description: 'Personalize sua página pública',
};

export default async function MyPageEditorPage() {
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
    .select('id, business_name, slug')
    .eq('user_id', user.id)
    .single();

  if (!professional) {
    redirect('/onboarding');
  }

  // Fetch existing sections
  const { data: sections } = await supabase
    .from('page_sections')
    .select('*')
    .eq('professional_id', professional.id)
    .order('order_index', { ascending: true });

  return (
    <div className="container mx-auto py-6 px-4 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Editor de Página</h1>
        <p className="text-muted-foreground mt-2">
          Personalize sua página pública e veja em tempo real
        </p>
        <a
          href={`/${professional.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline mt-2 inline-block"
        >
          Ver página pública →
        </a>
      </div>

      <PageEditor
        professionalId={professional.id}
        professionalSlug={professional.slug}
        initialSections={sections || []}
      />
    </div>
  );
}
