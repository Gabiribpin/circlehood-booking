'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, ChevronRight, Rocket } from 'lucide-react';
import { Link } from '@/navigation';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const t = useTranslations('onboarding');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [professionalId, setProfessionalId] = useState('');
  const [completion, setCompletion] = useState({
    services: false,
    schedule: false,
    whatsapp: false,
    profile: false,
  });

  // ─── Passos do onboarding (verificados no DB) ──────────────────────────────
  const STEPS = [
    {
      id: 'account',
      title: t('stepAccountTitle'),
      description: t('stepAccountDesc'),
      icon: '✅',
      href: null as string | null,
      actionLabel: null as string | null,
    },
    {
      id: 'services',
      title: t('stepServicesTitle'),
      description: t('stepServicesDesc'),
      icon: '✂️',
      href: '/services' as string | null,
      actionLabel: t('stepServicesAction'),
      badge: undefined as string | undefined,
    },
    {
      id: 'schedule',
      title: t('stepScheduleTitle'),
      description: t('stepScheduleDesc'),
      icon: '🕐',
      href: '/schedule' as string | null,
      actionLabel: t('stepScheduleAction'),
      badge: undefined as string | undefined,
    },
    {
      id: 'whatsapp',
      title: t('stepWhatsappTitle'),
      description: t('stepWhatsappDesc'),
      icon: '💬',
      href: '/whatsapp-config' as string | null,
      actionLabel: t('stepWhatsappAction'),
      badge: t('stepWhatsappBadge'),
    },
    {
      id: 'profile',
      title: t('stepProfileTitle'),
      description: t('stepProfileDesc'),
      icon: '🎨',
      href: '/my-page-editor' as string | null,
      actionLabel: t('stepProfileAction'),
      badge: undefined as string | undefined,
    },
  ];

  useEffect(() => { loadStatus(); }, []);

  async function loadStatus() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: professional } = await supabase
      .from('professionals')
      .select('id, bio')
      .eq('user_id', user.id)
      .single();
    if (!professional) return;
    setProfessionalId(professional.id);

    const [
      { count: servicesCount },
      { count: scheduleCount },
      { data: wc },
    ] = await Promise.all([
      supabase.from('services')
        .select('id', { count: 'exact', head: true })
        .eq('professional_id', professional.id).eq('is_active', true),
      supabase.from('working_hours')
        .select('id', { count: 'exact', head: true })
        .eq('professional_id', professional.id).eq('is_available', true),
      supabase.from('whatsapp_config')
        .select('is_active').eq('user_id', user.id).single(),
    ]);

    setCompletion({
      services: (servicesCount ?? 0) > 0,
      schedule: (scheduleCount ?? 0) > 0,
      whatsapp: wc?.is_active === true,
      profile: !!(professional.bio && professional.bio.length > 10),
    });
    setLoading(false);
  }

  function isStepDone(stepId: string): boolean {
    if (stepId === 'account') return true;
    return completion[stepId as keyof typeof completion] ?? false;
  }

  const doneCount = STEPS.filter((s) => isStepDone(s.id)).length;
  const allDone = doneCount === STEPS.length;
  const progressPct = Math.round((doneCount / STEPS.length) * 100);

  async function handleFinish() {
    if (!professionalId) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from('professionals').update({
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
    }).eq('id', professionalId);
    router.push('/dashboard');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
          <Rocket className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span data-testid="onboarding-progress-text" className="font-medium">
              {t('progress', { done: doneCount, total: STEPS.length })}
            </span>
            <span className="text-muted-foreground">{progressPct}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {allDone && (
            <p className="text-sm text-green-600 font-medium mt-2 text-center">
              {t('allDone')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Steps */}
      <div className="space-y-3">
        {STEPS.map((step, index) => {
          const done = isStepDone(step.id);
          return (
            <Card key={step.id} data-testid={`onboarding-step-${step.id}`} className={done ? 'opacity-75' : 'border-primary/30'}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <span className="text-2xl mt-0.5 shrink-0">{step.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">
                        {index + 1}. {step.title}
                      </p>
                      {step.badge && !done && (
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                          {step.badge}
                        </Badge>
                      )}
                      {done && (
                        <Badge variant="secondary" className="text-xs">{t('stepDone')}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <>
                        <Circle className="h-5 w-5 text-muted-foreground" />
                        {step.href && step.actionLabel && (
                          <Button size="sm" variant="outline" asChild>
                            <Link href={step.href}>
                              {step.actionLabel}
                              <ChevronRight className="h-3.5 w-3.5 ml-1" />
                            </Link>
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dicas */}
      <Card className="bg-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t('tipsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• {t('tip1')}</p>
          <p>• {t('tip2')}</p>
          <p>• {t('tip3')}</p>
          <p>• {t('tip4')}</p>
          <p>• {t('tip5')}</p>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex items-center justify-between pb-4">
        <Button data-testid="onboarding-skip" variant="ghost" onClick={() => router.push('/dashboard')}>
          {t('skip')}
        </Button>
        <Button
          data-testid="onboarding-finish"
          onClick={handleFinish}
          disabled={saving}
          className={allDone ? 'bg-green-600 hover:bg-green-700' : ''}
        >
          {saving ? t('saving') : allDone ? t('finish') : t('markDone')}
        </Button>
      </div>
    </div>
  );
}
