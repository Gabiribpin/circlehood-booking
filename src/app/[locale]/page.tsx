import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CircleHoodLogo } from '@/components/branding/logo';
import {
  CalendarDays,
  Globe,
  MessageCircle,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

export const metadata: Metadata = {
  title: 'CircleHood Booking | by CircleHood Tech',
};

export default function LandingPage() {
  const t = useTranslations('landing');

  const FEATURES = [
    {
      icon: Globe,
      title: t('featurePageTitle'),
      description: t('featurePageDesc'),
    },
    {
      icon: CalendarDays,
      title: t('featureBookingTitle'),
      description: t('featureBookingDesc'),
    },
    {
      icon: MessageCircle,
      title: t('featureWhatsappTitle'),
      description: t('featureWhatsappDesc'),
    },
    {
      icon: Sparkles,
      title: t('featureAiTitle'),
      description: t('featureAiDesc'),
    },
  ];

  const BENEFITS = [
    t('benefitReady'),
    t('benefitMobile'),
    t('benefitBookings247'),
    t('benefitNoWebsite'),
    t('benefitMultilingual'),
    t('benefitFreeTrial'),
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <CircleHoodLogo size="sm" showText={true} />
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">{t('headerLogin')}</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">{t('headerStartFree')}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 sm:py-28 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <CircleHoodLogo size="lg" showText={true} subtitle="by CircleHood Tech" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            {t('heroTitle')}
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('heroSubtitle')}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="gap-2">
              <Link href="/register">
                {t('heroCtaPrimary')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/demo">{t('heroCtaSecondary')}</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {t('heroTrialNote')}
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            {t('featuresHeading')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map((feature) => (
              <Card key={feature.title}>
                <CardContent className="p-6">
                  <feature.icon className="h-8 w-8 text-primary mb-3" />
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-muted-foreground text-sm">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8">
            {t('benefitsHeading')}
          </h2>
          <p className="text-muted-foreground mb-8">
            {t('benefitsSubtitle')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-md mx-auto">
            {BENEFITS.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                <span className="text-sm">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">
            {t('pricingHeading')}
          </h2>
          <p className="text-center text-muted-foreground mb-10">
            {t('pricingSubtitle')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Free / Trial */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{t('pricingFreeTitle')}</h3>
                  <p className="text-sm text-muted-foreground">{t('pricingFreeSubtitle')}</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">&euro;0</span>
                  <span className="text-muted-foreground text-sm">/{t('pricingFreePeriod')}</span>
                </div>
                <ul className="space-y-2">
                  {[
                    t('pricingFeaturePage'),
                    t('pricingFeature5Services'),
                    t('pricingFeatureBooking'),
                    t('pricingFeatureWhatsapp'),
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/register">{t('headerStartFree')}</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Pro */}
            <Card className="border-primary shadow-lg relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                  {t('pricingRecommended')}
                </span>
              </div>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">Pro</h3>
                  <p className="text-sm text-muted-foreground">{t('pricingProSubtitle')}</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">&euro;25</span>
                  <span className="text-muted-foreground text-sm">/{t('pricingProPeriod')}</span>
                </div>
                <ul className="space-y-2">
                  {[
                    t('pricingFeaturePage'),
                    t('pricingFeatureUnlimitedServices'),
                    t('pricingFeatureUnlimitedBookings'),
                    t('pricingFeatureWhatsapp'),
                    t('pricingFeatureAiBio'),
                    t('pricingFeatureEmailNotifications'),
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button asChild className="w-full">
                  <Link href="/register">{t('pricingProCta')}</Link>
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  {t('pricingCancelAnytime')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4">
          {t('ctaHeading')}
        </h2>
        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
          {t('ctaSubtitle')}
        </p>
        <Button asChild size="lg" className="gap-2">
          <Link href="/register">
            {t('ctaButton')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <CircleHoodLogo size="xs" showText={true} subtitle="by CircleHood Tech" />
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} CircleHood Tech. {t('footerRights')}
          </p>
        </div>
      </footer>
    </div>
  );
}
