import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BookingSection } from '@/components/booking/booking-section';
import { TrialBanner } from '@/components/public-page/trial-banner';
import { SectionRenderer } from '@/components/public-page/section-renderer';
import { SectionTestimonials } from '@/components/public-page/section-testimonials';
import { MapPin } from 'lucide-react';
import type { Professional, Service } from '@/types/database';
import type { PageSection } from '@/lib/page-sections/types';
import type { Metadata } from 'next';
import { CircleHoodLogoCompact } from '@/components/branding/logo';
import { isPublicPageAvailable } from '@/lib/trial-helpers';
import type { PublicPageStatus } from '@/lib/trial-helpers';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getProfessional(slug: string) {
  const supabase = await createClient();

  const { data: professional } = await supabase
    .from('professionals')
    .select('*, stripe_account_id')
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

  // Check if Stripe Connect onboarding is complete (charges_enabled)
  const { data: connectAccount } = await supabase
    .from('stripe_connect_accounts')
    .select('charges_enabled')
    .eq('professional_id', professional.id)
    .maybeSingle();

  const stripeChargesEnabled = connectAccount?.charges_enabled === true;

  const pageAvailability = await isPublicPageAvailable(professional.id);

  return {
    professional: professional as Professional,
    services: (services || []) as Service[],
    workingHours: workingHours || [],
    sections: (sections || []) as PageSection[],
    pageAvailability,
    stripeChargesEnabled,
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

  const url = `https://booking.circlehood-tech.com/${professional.slug}`;

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

  const { professional, services, workingHours, sections, pageAvailability, stripeChargesEnabled } = data;

  // Only offer deposit if Stripe Connect is fully onboarded (charges_enabled)
  const depositReady = (professional.require_deposit ?? false) && stripeChargesEnabled;

  // not_found or manually_disabled → hard 404
  if (
    !pageAvailability.available &&
    (pageAvailability.reason === 'not_found' || pageAvailability.reason === 'manually_disabled')
  ) {
    notFound();
  }

  const pageUnavailable = !pageAvailability.available;
  const unavailableReason = pageAvailability.reason as PublicPageStatus['reason'];

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
          {pageUnavailable && <TrialBanner reason={unavailableReason} />}
          {!pageUnavailable && (
            <>
              <AddressCard professional={professional} />
              <BookingSection
                services={services}
                professionalId={professional.id}
                currency={professional.currency}
                workingHours={workingHours}
                requireDeposit={depositReady}
                depositType={professional.deposit_type as 'percentage' | 'fixed' | null ?? null}
                depositValue={professional.deposit_value ?? null}
                stripeAccountId={(professional as any).stripe_account_id ?? null}
              />
              <SectionTestimonials
                data={{ heading: 'Depoimentos', displayMode: 'grid', showRatings: true, showPhotos: true, maxToShow: 6 }}
                professionalId={professional.id}
              />
            </>
          )}
          <footer className="text-center py-6 border-t mt-4">
            <a
              href="https://circlehood-tech.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <CircleHoodLogoCompact size="xs" />
              <span>Powered by <strong>CircleHood Tech</strong></span>
            </a>
          </footer>
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
    url: `https://booking.circlehood-tech.com/${professional.slug}`,
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
        {pageUnavailable && (
          <div className="max-w-lg mx-auto">
            <TrialBanner reason={unavailableReason} />
          </div>
        )}

        {/* Renderizar seções em ordem — apenas se página disponível */}
        {!pageUnavailable && sections.map((section) => (
          <SectionRenderer
            key={section.id}
            section={section}
            professional={professional}
            services={services}
            currency={professional.currency}
          />
        ))}

        {/* Booking Section - sempre no final se não estiver indisponível */}
        {!pageUnavailable && (
          <div className="max-w-lg mx-auto py-8 px-4">
            <AddressCard professional={professional} />
            <BookingSection
              services={services}
              professionalId={professional.id}
              currency={professional.currency}
              workingHours={workingHours}
              requireDeposit={depositReady}
              depositType={professional.deposit_type as 'percentage' | 'fixed' | null ?? null}
              depositValue={professional.deposit_value ?? null}
              stripeAccountId={(professional as any).stripe_account_id ?? null}
            />
          </div>
        )}
        {/* Footer: Powered by CircleHood Tech */}
        <footer className="text-center py-6 border-t mt-4">
          <a
            href="https://circlehood-tech.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <CircleHoodLogoCompact size="xs" />
            <span>Powered by <strong>CircleHood Tech</strong></span>
          </a>
        </footer>
        </div>
      </div>
    </>
  );
}
