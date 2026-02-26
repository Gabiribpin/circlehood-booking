import { createAdminClient } from '@/lib/supabase/admin';
import { hasPassedBusinessDays } from '@/lib/business-days';

export interface TrialStatus {
  isActive: boolean;       // Trial still valid (not expired)
  daysRemaining: number;   // Days left (0 if expired or not on trial)
  trialEndDate: Date | null;
  hasExpired: boolean;     // On trial AND past trial_ends_at
}

export interface PublicPageStatus {
  available: boolean;
  reason?: 'not_found' | 'trial_expired' | 'payment_failed' | 'manually_disabled';
}

/** Subset of reasons shown to the visitor on the public page */
export type PageUnavailableReason = 'trial_expired' | 'payment_failed';

// ---------------------------------------------------------------------------
// Trial status helpers
// ---------------------------------------------------------------------------

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

function computeTrialStatus(
  subscriptionStatus: string,
  trialEndsAt: string | null
): TrialStatus {
  const isTrial = subscriptionStatus === 'trial';

  if (!isTrial || !trialEndsAt) {
    return {
      isActive: false,
      daysRemaining: 0,
      trialEndDate: trialEndsAt ? new Date(trialEndsAt) : null,
      hasExpired: false,
    };
  }

  const now = new Date();
  const endDate = new Date(trialEndsAt);
  const msRemaining = endDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  const hasExpired = endDate < now;

  return {
    isActive: !hasExpired,
    hasExpired,
    daysRemaining,
    trialEndDate: endDate,
  };
}

// ---------------------------------------------------------------------------
// Public page availability
// ---------------------------------------------------------------------------

/**
 * Returns whether the professional's public page should be accessible,
 * along with the reason if unavailable.
 *
 * Rules:
 * - Deleted (deleted_at set)           → not_found
 * - Manually disabled (is_active=false) → manually_disabled
 * - Paid plan (active):
 *     payment_failed_at + 5 business days → payment_failed
 *     otherwise                            → available
 * - Trial:
 *     trial_ends_at >= now → available
 *     trial_ends_at < now  → trial_expired
 * - Any other status → trial_expired
 */
export async function isPublicPageAvailable(professionalId: string): Promise<PublicPageStatus> {
  const supabase = createAdminClient();

  const { data: professional } = await supabase
    .from('professionals')
    .select('subscription_status, trial_ends_at, is_active, deleted_at, payment_failed_at')
    .eq('id', professionalId)
    .maybeSingle();

  if (!professional) {
    return { available: false, reason: 'not_found' };
  }

  // Deleted → 404
  if (professional.deleted_at) {
    return { available: false, reason: 'not_found' };
  }

  // Manually disabled
  if (!professional.is_active) {
    return { available: false, reason: 'manually_disabled' };
  }

  // Paid plan — check payment failure grace period
  if (professional.subscription_status === 'active') {
    if (professional.payment_failed_at) {
      const failedDate = new Date(professional.payment_failed_at);
      if (hasPassedBusinessDays(failedDate, 5)) {
        return { available: false, reason: 'payment_failed' };
      }
    }
    return { available: true };
  }

  // Trial
  if (professional.subscription_status === 'trial') {
    if (!professional.trial_ends_at) {
      return { available: false, reason: 'trial_expired' };
    }
    if (new Date(professional.trial_ends_at) >= new Date()) {
      return { available: true };
    }
    return { available: false, reason: 'trial_expired' };
  }

  return { available: false, reason: 'trial_expired' };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Calculates a trial end date N days from now (default: 14 days).
 */
export function calculateTrialEndDate(days = 14): Date {
  const end = new Date();
  end.setDate(end.getDate() + days);
  return end;
}
