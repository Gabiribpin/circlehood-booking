'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TourStep {
  id: string;
  title: string;
  content: string;
  /** Selector for the element in the desktop sidebar. null = centered modal. */
  desktopTarget: string | null;
  /** Selector for the element in the mobile bottom-nav. null = centered modal on mobile. */
  mobileTarget: string | null;
}

interface TooltipState {
  style: React.CSSProperties;
  /** 'left' = desktop arrow ← | 'bottom' = mobile arrow ↓ | null = centered modal */
  arrowSide: 'left' | 'bottom' | null;
  /** px offset of the arrow along the tooltip edge */
  arrowOffset: number;
}

// ─── Tour Steps ────────────────────────────────────────────────────────────────

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: '👋 Bem-vindo ao CircleHood Booking!',
    content:
      'Vamos dar uma rápida volta para conhecer as principais funcionalidades. Você pode pular a qualquer momento.',
    desktopTarget: null,
    mobileTarget: null,
  },
  {
    id: 'services',
    title: '✂️ Serviços',
    content:
      'Comece por aqui. Cadastre os serviços que você oferece com nome, preço e duração.',
    desktopTarget: '[data-tour-id="services"]',
    mobileTarget: '[data-tour-id="services"]',
  },
  {
    id: 'schedule',
    title: '🕐 Horários',
    content:
      'Defina os dias da semana e horários em que você atende. Os clientes só verão slots disponíveis.',
    desktopTarget: '[data-tour-id="schedule"]',
    // Horários fica no Menu sheet (não na bottom nav) → modal centralizado no mobile
    mobileTarget: null,
  },
  {
    id: 'whatsapp',
    title: '💬 WhatsApp Bot',
    content:
      'Conecte seu WhatsApp para que os clientes agendem automaticamente — sem você precisar responder manualmente.',
    desktopTarget: '[data-tour-id="whatsapp"]',
    // WhatsApp fica no Menu sheet → modal centralizado no mobile
    mobileTarget: null,
  },
  {
    id: 'mypage',
    title: '🎨 Minha Página',
    content:
      'Sua página pública de agendamento. Personalize com foto, bio e cores. Compartilhe o link com seus clientes!',
    desktopTarget: '[data-tour-id="my-page"]',
    mobileTarget: '[data-tour-id="my-page"]',
  },
];

const STORAGE_KEY = 'circlehood-tour-completed';
const DESKTOP_W = 320; // minimum tooltip width on desktop (px)
const GAP = 12;        // gap between target element edge and tooltip (px)

// ─── Position Helpers ──────────────────────────────────────────────────────────

/**
 * Compute tooltip position and arrow type for a given DOM element.
 * Returns centered-modal style when el is null.
 */
function computeTooltip(el: Element | null, mobile: boolean): TooltipState {
  if (!el) {
    // Centered modal: welcome step, or step with no visible element on this device
    return {
      style: {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        minWidth: mobile ? 'calc(100vw - 32px)' : '360px',
        maxWidth: mobile ? 'calc(100vw - 32px)' : '480px',
      },
      arrowSide: null,
      arrowOffset: 0,
    };
  }

  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (mobile) {
    // ── Mobile: tooltip ABOVE the bottom-nav icon, arrow ↓ points toward icon ──
    const TOOLTIP_W = Math.min(vw - 32, 400);
    const iconCenterX = rect.left + rect.width / 2;

    let left = iconCenterX - TOOLTIP_W / 2;
    left = Math.max(16, Math.min(left, vw - TOOLTIP_W - 16));

    // Arrow horizontal offset relative to tooltip left edge (kept inside bounds)
    const arrowOffset = Math.max(16, Math.min(iconCenterX - left - 8, TOOLTIP_W - 32));

    // Tooltip bottom edge sits GAP above the element's top edge
    const bottom = vh - rect.top + GAP;

    return {
      style: {
        bottom: `${bottom}px`,
        left: `${left}px`,
        width: `${TOOLTIP_W}px`,
      },
      arrowSide: 'bottom',
      arrowOffset,
    };
  } else {
    // ── Desktop: tooltip RIGHT of sidebar item, arrow ← points toward it ──
    let left = rect.right + GAP;
    const top = Math.max(8, rect.top + rect.height / 2 - 80);

    // Flip to the left if tooltip would overflow the right edge
    if (left + DESKTOP_W > vw - 8) {
      left = rect.left - DESKTOP_W - GAP;
    }

    // Arrow vertical offset from tooltip top (vertically centers arrow on element midpoint)
    const arrowOffset = Math.max(12, rect.top + rect.height / 2 - top - 8);

    return {
      style: {
        top: `${top}px`,
        left: `${left}px`,
        minWidth: `${DESKTOP_W}px`,
        maxWidth: '400px',
      },
      arrowSide: 'left',
      arrowOffset,
    };
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function GuidedTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [spotlight, setSpotlight] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  // Show only on first visit
  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const t = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage not available (SSR guard)
    }
  }, []);

  // Recalculate tooltip position and spotlight rect for the current step
  const updateLayout = useCallback(() => {
    const current = TOUR_STEPS[step];
    const mobile = window.innerWidth < 768;
    const selector = mobile ? current.mobileTarget : current.desktopTarget;
    const el = selector ? document.querySelector(selector) : null;

    setTooltip(computeTooltip(el, mobile));

    if (el) {
      const r = el.getBoundingClientRect();
      setSpotlight({ top: r.top - 3, left: r.left - 3, width: r.width + 6, height: r.height + 6 });
    } else {
      setSpotlight(null);
    }
  }, [step]);

  useEffect(() => {
    if (!visible) return;
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, [visible, updateLayout]);

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

  if (!visible || !tooltip) return null;

  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <>
      {/* Dark backdrop — click anywhere to dismiss */}
      <div
        className="fixed inset-0 bg-black/50 z-[100]"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/*
        Spotlight ring: rendered ABOVE the backdrop (z-101) at the target element's
        position. Because the ring is a separate fixed div (not the element itself),
        it works even when the element's parent has a lower z-index (e.g. bottom-nav z-50).
      */}
      {spotlight && (
        <div
          className="fixed z-[101] pointer-events-none rounded-md ring-2 ring-primary"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
          aria-hidden="true"
        />
      )}

      {/* Tooltip card — above spotlight (z-103) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={current.title}
        className="fixed z-[103] bg-white dark:bg-card rounded-xl shadow-2xl border p-5"
        style={tooltip.style}
      >
        {/* Desktop arrow: ← points left toward the sidebar item */}
        {tooltip.arrowSide === 'left' && (
          <span
            className="absolute border-y-[8px] border-y-transparent border-r-[8px] border-r-white dark:border-r-card"
            style={{ left: '-8px', top: `${tooltip.arrowOffset}px` }}
            aria-hidden="true"
          />
        )}

        {/* Mobile arrow: ↓ points down toward the bottom-nav icon */}
        {tooltip.arrowSide === 'bottom' && (
          <span
            className="absolute border-x-[8px] border-x-transparent border-t-[8px] border-t-white dark:border-t-card"
            style={{ bottom: '-8px', left: `${tooltip.arrowOffset}px` }}
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
        <p className="font-semibold text-sm mb-1.5 pr-6">{current.title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4">{current.content}</p>

        {/* Step indicator dots */}
        <div className="flex items-center gap-1.5 mb-4">
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
