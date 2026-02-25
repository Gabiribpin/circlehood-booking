import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Metadata } from 'next';
import Link from 'next/link';
import { CircleHoodLogo } from '@/components/branding/logo';
import { Button } from '@/components/ui/button';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal' });
  return {
    title: `${t('termsTitle')} | CircleHood Booking`,
    description: t('termsMetaDesc'),
    robots: { index: true, follow: true },
  };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal' });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <CircleHoodLogo size="sm" showText={true} />
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/">{t('backHome')}</Link>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="prose prose-slate max-w-none">
          <h1 className="text-3xl font-bold mb-2">{t('termsTitle')}</h1>
          <p className="text-muted-foreground mb-10">{t('effectiveDate')}: 25 {t('february')} 2026</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">1. {t('termsAcceptance')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('termsAcceptanceText')}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">2. {t('termsService')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('termsServiceText')}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">3. {t('termsAccount')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('termsAccountText')}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">4. {t('termsPlans')}</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">{t('termsPlansText')}</p>
            <div className="bg-muted/40 rounded-lg p-4 space-y-2 text-sm text-muted-foreground">
              <p>• <strong>{t('termsFree')}</strong>: {t('termsFreeDesc')}</p>
              <p>• <strong>{t('termsPro')}</strong>: {t('termsProDesc')}</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">5. {t('termsCancellation')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('termsCancellationText')}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">6. {t('termsAcceptableUse')}</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">{t('termsAcceptableUseIntro')}</p>
            <ul className="space-y-1 text-muted-foreground text-sm">
              <li>• {t('termsNoSpam')}</li>
              <li>• {t('termsNoIllegal')}</li>
              <li>• {t('termsNoWhatsAppAbuse')}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">7. {t('termsIP')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('termsIPText')}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">8. {t('termsLiability')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('termsLiabilityText')}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">9. {t('termsGDPR')}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t('termsGDPRText')}{' '}
              <Link href="/privacy" className="text-primary underline">
                {t('privacyTitle')}
              </Link>
              .
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">10. {t('termsGoverningLaw')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('termsGoverningLawText')}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">11. {t('termsChanges')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('termsChangesText')}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">12. {t('termsContactSection')}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t('termsContactText')}{' '}
              <a href="mailto:legal@circlehood-tech.com" className="text-primary underline">
                legal@circlehood-tech.com
              </a>
            </p>
          </section>
        </div>

        <div className="border-t pt-8 mt-8 flex gap-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/">{t('backHome')}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/privacy">{t('privacyTitle')}</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
