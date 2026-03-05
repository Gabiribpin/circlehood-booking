'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { CircleHoodLogoCompact } from '@/components/branding/logo';
import {
  CheckCircle2,
  Lock,
  ChevronRight,
  Rocket,
  Trophy,
  Star,
  Shield,
  AlertTriangle,
  Scissors,
  Clock,
  MessageSquare,
  Bot,
  Palette,
  CreditCard,
} from 'lucide-react';

// ─── Step definition ────────────────────────────────────────────────────────
type StepDef = {
  id: string;
  tKey: string;
  icon: React.ReactNode;
  href: string | null;
  required: boolean;
};

const STEP_DEFS: StepDef[] = [
  { id: 'account',  tKey: 'Account',  icon: <Shield className="h-5 w-5" />,       href: null,                required: false },
  { id: 'services', tKey: 'Services', icon: <Scissors className="h-5 w-5" />,     href: '/services',         required: true },
  { id: 'schedule', tKey: 'Schedule', icon: <Clock className="h-5 w-5" />,        href: '/schedule',         required: true },
  { id: 'whatsapp', tKey: 'Whatsapp', icon: <MessageSquare className="h-5 w-5" />,href: '/whatsapp-config',  required: true },
  { id: 'botname',  tKey: 'Botname',  icon: <Bot className="h-5 w-5" />,          href: '/whatsapp-config?tab=ai',  required: false },
  { id: 'payment',  tKey: 'Payment',  icon: <CreditCard className="h-5 w-5" />,   href: '/settings/payment', required: false },
  { id: 'profile',  tKey: 'Profile',  icon: <Palette className="h-5 w-5" />,      href: '/my-page-editor',   required: false },
];

export default function OnboardingPage() {
  const router = useRouter();
  const t = useTranslations('onboarding');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [professionalId, setProfessionalId] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [completion, setCompletion] = useState<Record<string, boolean>>({
    account: true,
    services: false,
    schedule: false,
    whatsapp: false,
    botname: false,
    payment: false,
    profile: false,
  });

  const loadStatus = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: professional } = await supabase
      .from('professionals')
      .select('id, bio, business_name, payment_method')
      .eq('user_id', user.id)
      .single();
    if (!professional) return;
    setProfessionalId(professional.id);
    setBusinessName(professional.business_name || '');

    const [
      { count: servicesCount },
      { count: scheduleCount },
      { data: wc },
      { data: botConfig },
    ] = await Promise.all([
      supabase.from('services')
        .select('id', { count: 'exact', head: true })
        .eq('professional_id', professional.id).eq('is_active', true),
      supabase.from('working_hours')
        .select('id', { count: 'exact', head: true })
        .eq('professional_id', professional.id).eq('is_available', true),
      supabase.from('whatsapp_config')
        .select('is_active').eq('user_id', user.id).single(),
      supabase.from('bot_config')
        .select('bot_name').eq('user_id', user.id).single(),
    ]);

    setCompletion({
      account: true,
      services: (servicesCount ?? 0) > 0,
      schedule: (scheduleCount ?? 0) > 0,
      whatsapp: wc?.is_active === true,
      botname: !!(botConfig?.bot_name && botConfig.bot_name.trim().length > 0),
      payment: !!(professional.payment_method && professional.payment_method !== ''),
      profile: !!(professional.bio && professional.bio.length > 10),
    });
    setLoading(false);
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Refresh completion when tab regains focus
  useEffect(() => {
    const onFocus = () => { loadStatus(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadStatus]);

  // ─── Derived state ──────────────────────────────────────────────────────────
  const doneCount = STEP_DEFS.filter((s) => completion[s.id]).length;
  const progressPct = Math.round((doneCount / STEP_DEFS.length) * 100);
  const allDone = doneCount === STEP_DEFS.length;
  const criticalDone = completion.services && completion.schedule && completion.whatsapp;
  const canFinish = criticalDone;

  // Sequential unlock — optional steps never block the next step
  const firstIncompleteRequiredIdx = STEP_DEFS.findIndex((s) => s.required && !completion[s.id]);

  function isUnlocked(index: number): boolean {
    if (completion[STEP_DEFS[index].id]) return true;
    // All required steps before this one must be done
    for (let i = 0; i < index; i++) {
      if (STEP_DEFS[i].required && !completion[STEP_DEFS[i].id]) return false;
    }
    return true;
  }

  function getMotivational(): string {
    if (allDone) return t('motivational4');
    if (doneCount >= 4) return t('motivational3');
    if (doneCount >= 3) return t('motivational2');
    if (doneCount >= 2) return t('motivational1');
    return '';
  }

  async function handleFinish() {
    if (!professionalId || !canFinish) return;
    setSaving(true);
    setShowConfetti(true);
    setShowCelebration(true);
    const supabase = createClient();
    await supabase.from('professionals').update({
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
    }).eq('id', professionalId);
    setTimeout(() => {
      router.push('/dashboard');
    }, 3500);
  }

  // ─── Fullscreen loading ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary mx-auto" />
          <p className="text-sm text-muted-foreground animate-pulse">{t('loading')}</p>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] bg-background overflow-y-auto">
      {/* ── Animations ─────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg) scale(1); opacity: 1; }
          50% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(1080deg) scale(0.5); opacity: 0; }
        }
        .animate-confetti {
          animation: confetti-fall var(--duration, 3s) ease-out forwards;
          animation-delay: var(--delay, 0s);
        }
        @keyframes xp-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes slide-up {
          0% { opacity: 0; transform: translateY(24px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 12px rgba(34, 197, 94, 0.3); }
          50% { box-shadow: 0 0 30px rgba(34, 197, 94, 0.6); }
        }
        @keyframes celebration-pop {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes progress-shine {
          0% { left: -100%; }
          100% { left: 200%; }
        }
        .step-item {
          animation: slide-up 0.5s ease-out forwards;
          opacity: 0;
        }
        .glow-green { animation: glow 2s ease-in-out infinite; }
        .celebration-pop { animation: celebration-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .float-icon { animation: float 3s ease-in-out infinite; }
      `}</style>

      {/* ── Confetti ───────────────────────────────────────────────────────── */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[120] overflow-hidden" aria-hidden="true">
          {Array.from({ length: 80 }).map((_, i) => (
            <span
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                width: `${6 + Math.random() * 10}px`,
                height: `${6 + Math.random() * 10}px`,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#06b6d4', '#f97316'][i % 8],
                ['--delay' as string]: `${Math.random() * 1.5}s`,
                ['--duration' as string]: `${2 + Math.random() * 2.5}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* ── Celebration overlay ────────────────────────────────────────────── */}
      {showCelebration && (
        <div className="fixed inset-0 z-[110] bg-background/95 backdrop-blur-md flex items-center justify-center">
          <div className="text-center space-y-6 celebration-pop px-6">
            <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-green-100 dark:bg-green-900/30 glow-green">
              <Trophy className="h-14 w-14 text-green-500" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-green-600">{t('celebrationTitle')}</h2>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">{t('celebrationSubtitle')}</p>
          </div>
        </div>
      )}

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CircleHoodLogoCompact size="xs" />
            <div className="hidden sm:block">
              <p className="text-xs text-muted-foreground leading-none">{t('setupFor')}</p>
              <p className="text-sm font-semibold leading-tight">{businessName}</p>
            </div>
          </div>

          <div className="text-right">
            <p data-testid="onboarding-progress-text" className="text-xs font-bold">{progressPct}%</p>
            <p className="text-[10px] text-muted-foreground leading-none">{t('progress', { done: doneCount, total: STEP_DEFS.length })}</p>
          </div>
        </div>

        {/* Full-width progress bar */}
        <div className="h-1.5 bg-muted relative overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 via-green-400 to-green-500 transition-all duration-1000 ease-out relative"
            style={{ width: `${progressPct}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent" style={{ animation: 'progress-shine 2s ease-in-out infinite' }} />
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* ── Hero section ─────────────────────────────────────────────────── */}
        <div className="text-center mb-10 space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-xl shadow-primary/20 float-icon">
            <Rocket className="h-10 w-10 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{t('title')}</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-md mx-auto">{t('subtitle')}</p>
          </div>
          {getMotivational() && (
            <p className="text-sm font-semibold text-primary" style={{ animation: 'xp-pulse 2s ease-in-out infinite' }}>
              {getMotivational()}
            </p>
          )}
        </div>

        {/* ── Alert: why this matters ──────────────────────────────────────── */}
        {!criticalDone && (
          <div className="mb-8 rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-4 sm:p-5 step-item" style={{ animationDelay: '0s' }}>
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-orange-800 dark:text-orange-300">{t('whyTitle')}</p>
                <p className="text-xs text-orange-700 dark:text-orange-400 mt-1 leading-relaxed">{t('whyDesc')}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {!completion.services && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded-full px-2.5 py-1">
                      <Scissors className="h-3 w-3" /> {t('whyNoServices')}
                    </span>
                  )}
                  {!completion.schedule && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded-full px-2.5 py-1">
                      <Clock className="h-3 w-3" /> {t('whyNoSchedule')}
                    </span>
                  )}
                  {!completion.whatsapp && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded-full px-2.5 py-1">
                      <MessageSquare className="h-3 w-3" /> {t('whyNoWhatsapp')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Steps ────────────────────────────────────────────────────────── */}
        <div className="space-y-4 mb-10">
          {STEP_DEFS.map((step, index) => {
            const done = completion[step.id];
            const unlocked = isUnlocked(index);
            const isCurrent = !done && unlocked && (step.required ? index === firstIncompleteRequiredIdx : true);
            const stepT = (key: string) => t(`step${step.tKey}${key}`);

            return (
              <div
                key={step.id}
                data-testid={`onboarding-step-${step.id}`}
                className="step-item"
                style={{ animationDelay: `${0.1 + index * 0.08}s` }}
              >
                <div className={`
                  relative rounded-xl border-2 p-4 sm:p-5 transition-all duration-500
                  ${done
                    ? 'border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20'
                    : isCurrent
                      ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                      : !unlocked
                        ? 'border-muted bg-muted/30 opacity-50'
                        : 'border-border bg-card'
                  }
                `}>
                  <div className="flex items-start gap-4">
                    {/* Step circle */}
                    <div className={`
                      flex items-center justify-center w-12 h-12 rounded-xl shrink-0 transition-all duration-500
                      ${done
                        ? 'bg-green-500 text-white shadow-md shadow-green-500/30'
                        : isCurrent
                          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                          : !unlocked
                            ? 'bg-muted text-muted-foreground/40'
                            : 'bg-muted text-muted-foreground'
                      }
                    `}>
                      {done ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : !unlocked ? (
                        <Lock className="h-4 w-4" />
                      ) : (
                        step.icon
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-semibold text-sm ${done ? 'text-green-700 dark:text-green-400' : ''}`}>
                              {stepT('Title')}
                            </p>
                            {step.required && !done && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded">
                                {t('required')}
                              </span>
                            )}
                            {!step.required && !done && unlocked && (
                              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {t('optional')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {stepT('Desc')}
                          </p>

                          {/* "Why" warning for required incomplete steps */}
                          {step.required && !done && unlocked && (
                            <p className="text-[11px] text-orange-600 dark:text-orange-400 mt-1.5 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              {stepT('Why')}
                            </p>
                          )}
                        </div>

                      </div>

                      {/* Action button */}
                      {!done && unlocked && step.href && (
                        <Button size="sm" className="mt-3 h-9 text-xs gap-1.5 shadow-sm" asChild>
                          <a href={step.href} target="_blank" rel="noopener noreferrer">
                            {stepT('Action')}
                            <ChevronRight className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Dicas ────────────────────────────────────────────────────────── */}
        <div className="rounded-xl bg-muted/40 border p-5 mb-8 step-item" style={{ animationDelay: '0.6s' }}>
          <p className="text-sm font-semibold mb-3">{t('tipsTitle')}</p>
          <div className="text-xs text-muted-foreground space-y-1.5">
            <p>• {t('tip1')}</p>
            <p>• {t('tip2')}</p>
            <p>• {t('tip3')}</p>
            <p>• {t('tip4')}</p>
            <p>• {t('tip5')}</p>
          </div>
        </div>

        {/* ── Footer action ────────────────────────────────────────────────── */}
        <div className="sticky bottom-0 bg-background/80 backdrop-blur-lg border-t -mx-4 px-4 py-4 flex items-center justify-between">
          <div>
            <Button data-testid="onboarding-skip" variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => router.push('/dashboard')}>
              {t('skip')}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            {!canFinish && (
              <p className="text-xs text-muted-foreground max-w-[220px] text-right hidden sm:block">
                {t('finishHint')}
              </p>
            )}
            <Button
              data-testid="onboarding-finish"
              onClick={handleFinish}
              disabled={saving || !canFinish}
              size="lg"
              className={`gap-2 transition-all duration-300 ${
                canFinish
                  ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg shadow-green-500/25 text-white'
                  : ''
              }`}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                  {t('saving')}
                </>
              ) : (
                <>
                  <Trophy className="h-4 w-4" />
                  {canFinish ? t('finish') : t('markDone')}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
