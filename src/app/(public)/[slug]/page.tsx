import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BookingSection } from '@/components/booking/booking-section';
import { TrialBanner } from '@/components/public-page/trial-banner';
import { SectionRenderer } from '@/components/public-page/section-renderer';
import { MapPin } from 'lucide-react';
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

  const { professional, services } = data;

  const title = `${professional.business_name} | Agendamento Online`;
  const description =
    professional.bio ||
    `Agende ${professional.category || 'serviços'} com ${professional.business_name} em ${professional.city}. ${services.length} serviços disponíveis.`;

  const url = `https://book.circlehood-tech.com/${professional.slug}`;

  return {
    title,
    description,
    keywords: [
      professional.business_name,
      professional.category,
      professional.city,
      'agendamento online',
      'booking',
      'dublin',
      ...services.slice(0, 5).map((s) => s.name),
    ].filter((k): k is string => Boolean(k)),
    openGraph: {
      title,
      description,
      type: 'website',
      url,
      siteName: 'CircleHood Booking',
      locale: 'pt_BR',
      ...(professional.profile_image_url && {
        images: [
          {
            url: professional.profile_image_url,
            width: 1200,
            height: 630,
            alt: professional.business_name,
          },
        ],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(professional.profile_image_url && {
        images: [professional.profile_image_url],
      }),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
    alternates: {
      canonical: url,
    },
  };
}

function AddressCard({ professional }: { professional: any }) {
  const p = professional as any;
  if (p.show_address_on_page === false) return null;
  if (!p.address && !p.address_city) return null;

  const mapsQuery = encodeURIComponent(
    [p.address, p.address_city, p.address_country].filter(Boolean).join(', ')
  );

  return (
    <div className="px-4 sm:px-6 py-3">
      <div className="flex items-start gap-2 p-3 rounded-lg border bg-muted/30">
        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-sm">
          {p.address && <p className="font-medium">{p.address}</p>}
          {(p.address_city || p.address_country) && (
            <p className="text-muted-foreground">
              {[p.address_city, p.address_country].filter(Boolean).join(', ')}
            </p>
          )}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline mt-1 inline-block"
          >
            Ver no Google Maps →
          </a>
        </div>
      </div>
    </div>
  );
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
            <>
              <AddressCard professional={professional} />
              <BookingSection
                services={services}
                professionalId={professional.id}
                currency={professional.currency}
                workingHours={workingHours}
              />
            </>
          )}
        </div>
      </div>
    );
  }

  // JSON-LD Structured Data
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: professional.business_name,
    description: professional.bio || '',
    url: `https://book.circlehood-tech.com/${professional.slug}`,
    telephone: professional.phone || '',
    address: {
      '@type': 'PostalAddress',
      addressLocality: professional.city || 'Dublin',
      addressCountry: 'IE',
    },
    ...(professional.profile_image_url && {
      image: professional.profile_image_url,
    }),
    ...(services.length > 0 && {
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Services',
        itemListElement: services.slice(0, 10).map((service, index) => ({
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: service.name,
            description: service.description || '',
          },
          price: service.price,
          priceCurrency: professional.currency || 'EUR',
        })),
      },
    }),
  };

  // Renderizar com seções customizadas
  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

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
            <AddressCard professional={professional} />
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
    </>
  );
}
