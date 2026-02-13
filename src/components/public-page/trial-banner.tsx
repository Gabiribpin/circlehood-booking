import { AlertTriangle } from 'lucide-react';

export function TrialBanner() {
  return (
    <div className="mx-4 sm:mx-6 mt-4 p-4 rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-700">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
            Agendamento temporariamente indisponível
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
            O período de teste deste profissional expirou. Entre em contato diretamente para agendar.
          </p>
        </div>
      </div>
    </div>
  );
}
