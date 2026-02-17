import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BookingSection } from '@/components/booking/booking-section';
import { TrialBanner } from '@/components/public-page/trial-banner';
import { SectionRenderer } from '@/components/public-page/section-renderer';
import type { Professional, Service } from '@/types/database';
import type { PageSection } from '@/lib/page-sections/types';
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

  // Buscar seções customizadas da página
  const { data: sections } = await supabase
    .from('page_sections')
    .select('*')
    .eq('professional_id', professional.id)
    .eq('is_visible', true)
    .order('order_index', { ascending: true });

  const trialExpired =
    professional.subscription_status === 'trial' &&
    new Date(professional.trial_ends_at) < new Date();

  return {
    professional: professional as Professional,
    services: (services || []) as Service[],
    workingHours: workingHours || [],
    sections: (sections || []) as PageSection[],
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

  const { professional, services, workingHours, sections, trialExpired } = data;

  // Se não houver seções customizadas, usar layout padrão
  if (!sections || sections.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto pb-8">
          {/* Fallback para layout padrão - componentes antigos */}
          <div className="text-center py-12 px-4">
            <h1 className="text-3xl font-bold mb-4">{professional.business_name}</h1>
            {professional.bio && <p className="text-gray-600 mb-6">{professional.bio}</p>}
          </div>
          {trialExpired && <TrialBanner />}
          {!trialExpired && (
            <BookingSection
              services={services}
              professionalId={professional.id}
              currency={professional.currency}
              workingHours={workingHours}
            />
          )}
        </div>
      </div>
    );
  }

  // Renderizar com seções customizadas
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto">
        {trialExpired && (
          <div className="max-w-lg mx-auto">
            <TrialBanner />
          </div>
        )}

        {/* Renderizar seções em ordem */}
        {sections.map((section) => (
          <SectionRenderer
            key={section.id}
            section={section}
            professional={professional}
            services={services}
            currency={professional.currency}
          />
        ))}

        {/* Booking Section - sempre no final se não estiver no trial expirado */}
        {!trialExpired && (
          <div className="max-w-lg mx-auto py-8 px-4">
            <BookingSection
              services={services}
              professionalId={professional.id}
              currency={professional.currency}
              workingHours={workingHours}
            />
          </div>
        )}
      </div>
    </div>
  );
}
