import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TestimonialsManager } from './testimonials-manager';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'testimonials' });
  return {
    title: `${t('title')} | CircleHood Booking`,
    description: t('subtitle'),
  };
}

export default async function TestimonialsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
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

  // Fetch existing testimonials
  const { data: testimonials } = await supabase
    .from('testimonials')
    .select('*')
    .eq('professional_id', professional.id)
    .order('order_index', { ascending: true });

  const t = await getTranslations('testimonials');

  return (
    <div className="container mx-auto py-6 px-4 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('subtitle')}</p>
      </div>

      <TestimonialsManager
        professionalId={professional.id}
        initialTestimonials={testimonials || []}
      />
    </div>
  );
}
