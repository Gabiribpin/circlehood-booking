import { PageSection } from '@/lib/page-sections/types';
import { Hero } from './hero';
import { SectionAbout } from './section-about';
import { ServicesList } from './services-list';
import { SectionGallery } from './section-gallery';
import { SectionTestimonials } from './section-testimonials';
import { SectionFAQ } from './section-faq';
import { ContactFooter } from './contact-footer';
import type { Professional, Service } from '@/types/database';

interface SectionRendererProps {
  section: PageSection;
  professional: Professional;
  services?: Service[];
  currency?: string;
}

export function SectionRenderer({
  section,
  professional,
  services,
  currency,
}: SectionRendererProps) {
  // Não renderizar seções invisíveis
  if (!section.is_visible) {
    return null;
  }

  switch (section.section_type) {
    case 'hero':
      return <Hero professional={professional} />;

    case 'about':
      return <SectionAbout data={section.data as any} theme={section.theme} />;

    case 'services':
      if (!services || services.length === 0) return null;
      return (
        <div className="py-8">
          <h2 className="text-2xl font-bold mb-6 text-center px-4">
            {(section.data as any).heading || 'Meus Serviços'}
          </h2>
          <ServicesList services={services} currency={currency || 'EUR'} />
        </div>
      );

    case 'gallery':
      return (
        <SectionGallery
          data={section.data as any}
          professionalId={professional.id}
          theme={section.theme}
        />
      );

    case 'testimonials':
      return (
        <SectionTestimonials
          data={section.data as any}
          professionalId={professional.id}
          theme={section.theme}
        />
      );

    case 'faq':
      return <SectionFAQ data={section.data as any} theme={section.theme} />;

    case 'contact':
      return <ContactFooter professional={professional} />;

    default:
      return null;
  }
}
