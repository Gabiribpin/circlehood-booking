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
    title: `${t('privacyTitle')} | CircleHood Booking`,
    description: t('privacyMetaDesc'),
    robots: { index: true, follow: true },
  };
}

export default async function PrivacyPage({
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
          <h1 className="text-3xl font-bold mb-2">{t('privacyTitle')}</h1>
          <p className="text-muted-foreground mb-10">{t('effectiveDate')}: 25 {t('february')} 2026</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">1. {t('privacyWhoWeAre')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('privacyWhoWeAreText')}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">2. {t('privacyWhatWeCollect')}</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">{t('privacyWhatWeCollectIntro')}</p>
            <div className="bg-muted/40 rounded-lg p-4 space-y-3">
              <div>
                <p className="font-medium">{t('privacyProfessionals')}</p>
                <p className="text-muted-foreground text-sm">{t('privacyProfessionalsData')}</p>
              </div>
              <div>
                <p className="font-medium">{t('privacyClients')}</p>
                <p className="text-muted-foreground text-sm">{t('privacyClientsData')}</p>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">3. {t('privacyWhyWeCollect')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('privacyWhyWeCollectText')}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">4. {t('privacyLegalBasis')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('privacyLegalBasisText')}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">5. {t('privacySharing')}</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">{t('privacySharingIntro')}</p>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>• <strong>Supabase</strong> — {t('privacySharingSupabase')}</li>
              <li>• <strong>Stripe</strong> — {t('privacySharingStripe')}</li>
              <li>• <strong>Resend</strong> — {t('privacySharingResend')}</li>
              <li>• <strong>Evolution API</strong> — {t('privacySharingEvolution')}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">6. {t('privacyCookies')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('privacyCookiesText')}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">7. {t('privacyRights')}</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">{t('privacyRightsIntro')}</p>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>• <strong>{t('rightAccess')}</strong>: {t('rightAccessDesc')}</li>
              <li>• <strong>{t('rightRectification')}</strong>: {t('rightRectificationDesc')}</li>
              <li>• <strong>{t('rightErasure')}</strong>: {t('rightErasureDesc')}</li>
              <li>• <strong>{t('rightPortability')}</strong>: {t('rightPortabilityDesc')}</li>
              <li>• <strong>{t('rightObjection')}</strong>: {t('rightObjectionDesc')}</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">{t('privacyRightsHow')}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">8. {t('privacyRetention')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('privacyRetentionText')}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">9. {t('privacyTransfers')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('privacyTransfersText')}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">10. {t('privacyMinors')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('privacyMinorsText')}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">11. {t('privacyChanges')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('privacyChangesText')}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">12. {t('privacyContact')}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t('privacyContactText')}{' '}
              <a href="mailto:privacy@circlehood-tech.com" className="text-primary underline">
                privacy@circlehood-tech.com
              </a>
            </p>
          </section>
        </div>

        <div className="border-t pt-8 mt-8 flex gap-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/">{t('backHome')}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/terms">{t('termsTitle')}</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
