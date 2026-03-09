import { Hero } from '@/components/public-page/hero';
import { ServicesList } from '@/components/public-page/services-list';
import { ContactFooter } from '@/components/public-page/contact-footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CircleHoodLogoCompact } from '@/components/branding/logo';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Professional, Service } from '@/types/database';
import type { Metadata } from 'next';

function buildDemoProfessional(bio: string): Professional {
  return {
    id: 'demo-000',
    user_id: 'demo-000',
    slug: 'demo',
    business_name: "Maria's Nails",
    category: 'Nail Tech',
    bio,
    phone: '+353871234567',
    whatsapp: '+353871234567',
    instagram: 'mariasnails',
    profile_image_url: null,
    cover_image_url: null,
    address: null,
    city: 'Dublin',
    country: 'Ireland',
    currency: 'EUR',
    timezone: 'Europe/Dublin',
    is_active: true,
    trial_ends_at: '2099-12-31T23:59:59Z',
    subscription_status: 'active',
    stripe_customer_id: null,
    created_at: '2024-01-01T00:00:00Z',
  };
}

function buildDemoServices(t: ReturnType<typeof useTranslations>): Service[] {
  return [
    {
      id: 'demo-s1',
      professional_id: 'demo-000',
      name: t('demoService1'),
      description: t('demoService1Desc'),
      duration_minutes: 60,
      price: 35,
      is_active: true,
      sort_order: 0,
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'demo-s2',
      professional_id: 'demo-000',
      name: t('demoService2'),
      description: t('demoService2Desc'),
      duration_minutes: 75,
      price: 45,
      is_active: true,
      sort_order: 1,
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'demo-s3',
      professional_id: 'demo-000',
      name: t('demoService3'),
      description: t('demoService3Desc'),
      duration_minutes: 120,
      price: 80,
      is_active: true,
      sort_order: 2,
      created_at: '2024-01-01T00:00:00Z',
    },
  ];
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('public');
  return {
    title: "Maria's Nails - Demo | CircleHood",
    description: t('demoBannerDescription'),
  };
}

export default function DemoPage() {
  const t = useTranslations('public');

  const professional = buildDemoProfessional(t('demoBio'));
  const services = buildDemoServices(t);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto">
        {/* Same Hero as real public pages */}
        <Hero professional={professional} />

        {/* Services — same ServicesList component */}
        <div className="max-w-lg mx-auto py-8 px-4">
          <ServicesList services={services} currency={professional.currency} />
        </div>

        {/* Contact — same ContactFooter component */}
        <div className="max-w-lg mx-auto">
          <ContactFooter professional={professional} />
        </div>

        {/* Demo Banner */}
        <div className="max-w-lg mx-auto px-4">
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-6 text-center">
              <p className="text-lg font-semibold mb-2">
                {t('demoBanner')}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {t('demoBannerDescription')}
              </p>
              <Button size="lg" asChild>
                <Link href="/register">
                  {t('demoCTA')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <footer className="text-center py-6 border-t mt-8">
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
