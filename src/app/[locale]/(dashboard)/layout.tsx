import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { MobileNav } from '@/components/dashboard/mobile-nav';
import { Sidebar } from '@/components/dashboard/sidebar';
import { CircleHoodLogoCompact } from '@/components/branding/logo';
import { GuidedTour } from '@/components/onboarding/guided-tour';
import { EmailVerificationBanner } from '@/components/dashboard/email-verification-banner';
import { TrialExpirationBanner } from '@/components/dashboard/trial-expiration-banner';
import { getTrialStatus } from '@/lib/trial-helpers';
import { getTranslations } from 'next-intl/server';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations('nav');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: professional } = await supabase
    .from('professionals')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // OAuth user without professional record → complete profile
  if (!professional) {
    redirect('/complete-profile');
  }

  // Block dashboard access if email not verified yet
  if (professional && professional.email_verified === false) {
    redirect('/verify-email-pending');
  }

  // Block dashboard access if no active subscription (must go through Stripe Checkout first)
  if (professional && professional.subscription_status !== 'active') {
    // Allow access if subscription_status is 'trial' AND they have a stripe_customer_id
    // (meaning they went through checkout and Stripe gave them a trial)
    const hasStripeSubscription = !!professional.stripe_customer_id;
    if (!hasStripeSubscription) {
      redirect('/subscribe');
    }
  }

  // Check if onboarding is incomplete (used for persistent banner below)
  const onboardingPending = professional && !professional.onboarding_completed;

  // Trial status for banner
  const trialStatus = user ? await getTrialStatus(user.id) : null;

  // Badge: contagem de notificações com falha nos últimos 30 dias
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: failedNotificationsCount } = professional
    ? await supabase
        .from('notification_logs')
        .select('*', { count: 'exact', head: true })
        .eq('professional_id', professional.id)
        .eq('status', 'failed')
        .gte('created_at', since30d)
    : { count: 0 };
  const failedCount = failedNotificationsCount ?? 0;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <Sidebar
        professionalSlug={professional?.slug}
        businessName={professional?.business_name}
        userEmail={user.email}
        failedNotificationsCount={failedCount}
      />

      {/* Mobile header */}
      <div className="flex-1 flex flex-col">
        <header className="md:hidden border-b px-4 py-3 flex items-center">
          <Link href="/dashboard" className="flex items-center gap-2">
            <CircleHoodLogoCompact size="xs" />
            <span className="text-sm font-bold">CircleHood Booking</span>
          </Link>
        </header>

        {/* Mobile bottom nav */}
        <MobileNav professionalSlug={professional?.slug} failedNotificationsCount={failedCount} />

        <GuidedTour />

        {/* Onboarding incomplete banner — persistent, prominent warning */}
        {onboardingPending && (
          <div data-testid="onboarding-pending-banner" className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-3">
            <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl shrink-0">⚠️</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-tight">{t('onboardingBannerTitle')}</p>
                  <p className="text-xs text-white/80 leading-tight mt-0.5 hidden sm:block">{t('onboardingBannerDesc')}</p>
                </div>
              </div>
              <Link
                href="/onboarding"
                className="shrink-0 bg-white text-orange-600 hover:bg-white/90 font-bold text-xs px-4 py-2 rounded-lg transition-colors shadow-sm"
              >
                {t('onboardingBannerAction')}
              </Link>
            </div>
          </div>
        )}

        {/* Email verification banner — shown if email_verified=false (shouldn't reach here due to redirect, but safety net) */}
        {professional?.email_verified === false && user.email && (
          <div className="px-4 pt-3">
            <EmailVerificationBanner userEmail={user.email} />
          </div>
        )}

        {/* Trial expiration banner — shown when ≤7 days remain */}
        {trialStatus?.isActive && trialStatus.daysRemaining <= 7 && trialStatus.trialEndDate && (
          <div className="px-4 pt-3">
            <TrialExpirationBanner
              daysRemaining={trialStatus.daysRemaining}
              trialEndsAt={trialStatus.trialEndDate.toISOString()}
            />
          </div>
        )}

        {/* Deletion pending banner */}
        {professional?.deleted_at && professional?.deletion_scheduled_for && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-yellow-800">
              ⚠️ {t('deletionBanner', {
                date: new Date(professional.deletion_scheduled_for).toLocaleDateString('pt-BR'),
              })}
            </p>
            <form action="/api/account/cancel-deletion" method="POST">
              <button
                type="submit"
                className="text-xs text-yellow-900 underline hover:no-underline whitespace-nowrap"
              >
                {t('cancelDeletion')}
              </button>
            </form>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 md:p-8 pb-20 md:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
