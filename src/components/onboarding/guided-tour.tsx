'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface TourStep {
  id: string;
  title: string;
  content: string;
  /** CSS selector of the element to highlight. null = centered dialog. */
  target: string | null;
  /** Where to position the tooltip relative to the target */
  placement?: 'right' | 'bottom' | 'left' | 'top';
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: '👋 Bem-vindo ao CircleHood Booking!',
    content:
      'Vamos dar uma rápida volta para conhecer as principais funcionalidades. Você pode pular a qualquer momento.',
    target: null,
  },
  {
    id: 'services',
    title: '✂️ Serviços',
    content:
      'Comece por aqui. Cadastre os serviços que você oferece com nome, preço e duração.',
    target: 'a[href="/services"]',
    placement: 'right',
  },
  {
    id: 'schedule',
    title: '🕐 Horários',
    content:
      'Defina os dias da semana e horários em que você atende. Os clientes só verão slots disponíveis.',
    target: 'a[href="/schedule"]',
    placement: 'right',
  },
  {
    id: 'whatsapp',
    title: '💬 WhatsApp Bot',
    content:
      'Conecte seu WhatsApp para que os clientes agendem automaticamente — sem você precisar responder manualmente.',
    target: 'a[href="/whatsapp-config"]',
    placement: 'right',
  },
  {
    id: 'mypage',
    title: '🎨 Minha Página',
    content:
      'Sua página pública de agendamento. Personalize com foto, bio e cores. Compartilhe o link com seus clientes!',
    target: 'a[href="/my-page"]',
    placement: 'right',
  },
];

const STORAGE_KEY = 'circlehood-tour-completed';

interface TooltipPosition {
  top: number;
  left: number;
  arrowSide: 'top' | 'left' | 'none';
}

function getPosition(el: Element | null, placement: TourStep['placement']): TooltipPosition | null {
  if (!el) return null;

  const rect = el.getBoundingClientRect();
  const TOOLTIP_W = 288; // w-72
  const GAP = 12;

  if (placement === 'right') {
    return {
      top: rect.top + rect.height / 2 - 80,
      left: rect.right + GAP,
      arrowSide: 'left',
    };
  }

  if (placement === 'bottom') {
    return {
      top: rect.bottom + GAP,
      left: Math.max(8, rect.left - TOOLTIP_W / 2 + rect.width / 2),
      arrowSide: 'top',
    };
  }

  return {
    top: rect.bottom + GAP,
    left: Math.max(8, rect.left),
    arrowSide: 'top',
  };
}

export function GuidedTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState<TooltipPosition | null>(null);

  // Show only on first visit
  useEffect(() => {
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) {
        // Small delay so the DOM is fully rendered
        const t = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage not available (SSR guard)
    }
  }, []);

  // Update tooltip position when step changes
  const updatePosition = useCallback(() => {
    const current = TOUR_STEPS[step];
    if (!current?.target) {
      setPos(null);
      return;
    }

    // Try sidebar first, then mobile nav
    const el =
      document.querySelector(`.md\\:flex ${current.target}`) ||
      document.querySelector(current.target);

    setPos(getPosition(el, current.placement ?? 'right'));
  }, [step]);

  useEffect(() => {
    if (!visible) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [visible, updatePosition]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch { /* */ }
    setVisible(false);
  }, []);

  const next = useCallback(() => {
    if (step < TOUR_STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }, [step, dismiss]);

  if (!visible) return null;

  const current = TOUR_STEPS[step];
  const isCentered = !current.target || !pos;
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[100]"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Tooltip card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={current.title}
        className="fixed z-[101] w-72 bg-white dark:bg-card rounded-xl shadow-2xl border p-4"
        style={
          isCentered
            ? {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }
            : {
                top: `${Math.max(8, pos!.top)}px`,
                left: `${Math.min(pos!.left, window.innerWidth - 296)}px`,
              }
        }
      >
        {/* Arrow — only when positioned next to an element */}
        {!isCentered && pos?.arrowSide === 'left' && (
          <span
            className="absolute -left-2 top-8 w-0 h-0 border-y-8 border-y-transparent border-r-8 border-r-white dark:border-r-card"
            aria-hidden="true"
          />
        )}
        {!isCentered && pos?.arrowSide === 'top' && (
          <span
            className="absolute -top-2 left-6 w-0 h-0 border-x-8 border-x-transparent border-b-8 border-b-white dark:border-b-card"
            aria-hidden="true"
          />
        )}

        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Fechar tour"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <p className="font-semibold text-sm mb-1 pr-5">{current.title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4">{current.content}</p>

        {/* Step dots */}
        <div className="flex items-center gap-1 mb-3">
          {TOUR_STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === step ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={dismiss}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Pular tour
          </button>
          <Button size="sm" onClick={next} className="h-7 px-3 text-xs">
            {isLast ? 'Concluir' : 'Próximo →'}
          </Button>
        </div>
      </div>
    </>
  );
}
