import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Hero } from '@/components/public-page/hero';
import { ServicesList } from '@/components/public-page/services-list';
import { BookingSection } from '@/components/booking/booking-section';
import { TrialBanner } from '@/components/public-page/trial-banner';
import { ContactFooter } from '@/components/public-page/contact-footer';
import type { Professional, Service } from '@/types/database';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getProfessional(slug: string) {
  const supabase = await createClient();

  const { data: professional } = await supabase
    .from('professionals')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!professional) return null;

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('professional_id', professional.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const { data: workingHours } = await supabase
    .from('working_hours')
    .select('*')
    .eq('professional_id', professional.id)
    .eq('is_available', true)
    .order('day_of_week', { ascending: true });

  const trialExpired =
    professional.subscription_status === 'trial' &&
    new Date(professional.trial_ends_at) < new Date();

  return {
    professional: professional as Professional,
    services: (services || []) as Service[],
    workingHours: workingHours || [],
    trialExpired,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProfessional(slug);

  if (!data) {
    return { title: 'Página não encontrada' };
  }

  const { professional } = data;

  return {
    title: `${professional.business_name} | CircleHood Booking`,
    description:
      professional.bio ||
      `Agende com ${professional.business_name} em ${professional.city}`,
    openGraph: {
      title: professional.business_name,
      description:
        professional.bio ||
        `${professional.category || 'Profissional'} em ${professional.city}`,
      type: 'website',
      url: `https://book.circlehood-tech.com/${professional.slug}`,
      ...(professional.profile_image_url && {
        images: [{ url: professional.profile_image_url }],
      }),
    },
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getProfessional(slug);

  if (!data) {
    notFound();
  }

  const { professional, services, workingHours, trialExpired } = data;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto pb-8">
        <Hero professional={professional} />
        {trialExpired && <TrialBanner />}
        <ServicesList services={services} currency={professional.currency} />
        {!trialExpired && (
          <BookingSection
            services={services}
            professionalId={professional.id}
            currency={professional.currency}
            workingHours={workingHours}
          />
        )}
        <ContactFooter professional={professional} />
      </div>
    </div>
  );
}
