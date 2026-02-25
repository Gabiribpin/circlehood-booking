import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { GalleryManager } from './gallery-manager';

export async function generateMetadata() {
  const t = await getTranslations('gallery');
  return {
    title: `${t('title')} | CircleHood Booking`,
    description: t('subtitle'),
  };
}

export default async function GalleryPage() {
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
    .select('id, business_name')
    .eq('user_id', user.id)
    .single();

  if (!professional) {
    redirect('/onboarding');
  }

  // Fetch existing images
  const { data: images } = await supabase
    .from('gallery_images')
    .select('*')
    .eq('professional_id', professional.id)
    .order('order_index', { ascending: true });

  const t = await getTranslations('gallery');

  return (
    <div className="container mx-auto py-6 px-4 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('subtitle')}</p>
      </div>

      <GalleryManager professionalId={professional.id} initialImages={images || []} />
    </div>
  );
}
