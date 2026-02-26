import { AlertTriangle } from 'lucide-react';
import type { PublicPageStatus } from '@/lib/trial-helpers';

type BannerReason = NonNullable<PublicPageStatus['reason']>;

interface TrialBannerProps {
  reason?: BannerReason;
}

const SUBTITLES: Record<BannerReason, string> = {
  trial_expired: 'O período de teste expirou.',
  payment_failed: 'Houve um problema com o pagamento da assinatura.',
  manually_disabled: 'Esta página foi temporariamente desativada pelo profissional.',
  not_found: 'Esta página não está disponível.',
};

/**
 * Shown on the public page when a professional's page is unavailable.
 * Accepts an optional `reason` to tailor the subtitle.
 */
export function TrialBanner({ reason = 'trial_expired' }: TrialBannerProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Página Indisponível</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Esta página profissional está temporariamente indisponível.{' '}
            {SUBTITLES[reason]}
          </p>
        </div>

        {/* Box for clients */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Para clientes
          </p>
          <p className="text-sm text-gray-600">
            Por favor, entre em contato diretamente com o profissional por telefone ou WhatsApp para agendar.
          </p>
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-400">
          🎪 Powered by{' '}
          <a
            href="https://circlehood-tech.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-600"
          >
            CircleHood Tech
          </a>
        </p>
      </div>
    </div>
  );
}
