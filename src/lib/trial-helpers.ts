import { createAdminClient } from '@/lib/supabase/admin';
import { hasPassedBusinessDays } from '@/lib/business-days';

export type PageUnavailableReason = 'trial_expired' | 'payment_failed';

export interface TrialStatus {
  isTrialActive: boolean;   // On trial and not yet expired
  hasExpired: boolean;      // On trial AND past trial_ends_at
  isPaidPlan: boolean;      // subscription_status = 'active'
  daysRemaining: number;    // Days left (0 if expired)
  trialEndsAt: Date | null;
}

/**
 * Returns the trial status for a professional looked up by their auth user_id.
 * Uses the admin client to bypass RLS.
 */
export async function getTrialStatus(userId: string): Promise<TrialStatus | null> {
  const supabase = createAdminClient();

  const { data: professional } = await supabase
    .from('professionals')
    .select('subscription_status, trial_ends_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!professional) return null;

  return computeTrialStatus(professional.subscription_status, professional.trial_ends_at);
}

/**
 * Returns the trial status for a professional looked up by their professional id.
 */
export async function getTrialStatusById(professionalId: string): Promise<TrialStatus | null> {
  const supabase = createAdminClient();

  const { data: professional } = await supabase
    .from('professionals')
    .select('subscription_status, trial_ends_at')
    .eq('id', professionalId)
    .maybeSingle();

  if (!professional) return null;

  return computeTrialStatus(professional.subscription_status, professional.trial_ends_at);
}

function computeTrialStatus(subscriptionStatus: string, trialEndsAt: string | null): TrialStatus {
  const isPaidPlan = subscriptionStatus === 'active';
  const isTrial = subscriptionStatus === 'trial';

  if (!isTrial || !trialEndsAt) {
    return {
      isTrialActive: false,
      hasExpired: false,
      isPaidPlan,
      daysRemaining: 0,
      trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
    };
  }

  const now = new Date();
  const endDate = new Date(trialEndsAt);
  const msRemaining = endDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  const hasExpired = endDate < now;

  return {
    isTrialActive: !hasExpired,
    hasExpired,
    isPaidPlan: false,
    daysRemaining,
    trialEndsAt: endDate,
  };
}

export interface PageAvailability {
  available: boolean;
  reason?: PageUnavailableReason;
}

/**
 * Returns whether the professional's public page should be accessible,
 * along with the reason if unavailable.
 *
 * Rules:
 * - Paid plan (active): available, unless payment_failed_at + 5 business days has passed
 * - Trial: available while trial_ends_at >= now
 * - Anything else: unavailable (trial_expired)
 */
export async function isPublicPageAvailable(professionalId: string): Promise<PageAvailability> {
  const supabase = createAdminClient();

  const { data: professional } = await supabase
    .from('professionals')
    .select('subscription_status, trial_ends_at, is_active, payment_failed_at')
    .eq('id', professionalId)
    .maybeSingle();

  if (!professional) return { available: false, reason: 'trial_expired' };
  if (!professional.is_active) return { available: false, reason: 'trial_expired' };

  // Paid plan
  if (professional.subscription_status === 'active') {
    if (professional.payment_failed_at) {
      const failedAt = new Date(professional.payment_failed_at);
      if (hasPassedBusinessDays(failedAt, 5)) {
        return { available: false, reason: 'payment_failed' };
      }
    }
    return { available: true };
  }

  // Trial
  if (professional.subscription_status === 'trial') {
    if (!professional.trial_ends_at) return { available: false, reason: 'trial_expired' };
    if (new Date(professional.trial_ends_at) >= new Date()) return { available: true };
    return { available: false, reason: 'trial_expired' };
  }

  return { available: false, reason: 'trial_expired' };
}

/**
 * Calculates a trial end date 14 days from now.
 */
export function calculateTrialEndDate(days = 14): Date {
  const end = new Date();
  end.setDate(end.getDate() + days);
  return end;
}
