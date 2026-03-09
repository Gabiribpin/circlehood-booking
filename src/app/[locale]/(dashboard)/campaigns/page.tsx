import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

/**
 * Campanhas — FUNCIONALIDADE DESATIVADA
 *
 * O envio em massa via WhatsApp (Evolution API / QR Code) foi desativado para
 * proteger o número dos profissionais contra bloqueio permanente pelo WhatsApp.
 *
 * Uso permitido: bot conversacional (cliente inicia, bot responde).
 * Uso proibido:  campanhas, lembretes em massa, broadcast.
 */
export default async function CampaignsPage() {
  const t = await getTranslations('campaigns');

  return (
    <div className="max-w-2xl mx-auto mt-12 px-4">
      <Card className="border-yellow-400/60 bg-yellow-50 dark:bg-yellow-950/20">
        <CardContent className="p-8 text-center space-y-4">
          <ShieldAlert className="h-12 w-12 text-yellow-600 mx-auto" />

          <h2 className="text-xl font-bold text-yellow-900 dark:text-yellow-100">
            {t('disabledTitle')}
          </h2>

          <p className="text-yellow-800 dark:text-yellow-200 text-sm leading-relaxed">
            {t('disabledDesc')}
          </p>

          <div className="bg-white dark:bg-yellow-900/30 rounded-lg p-4 text-left space-y-1 text-sm">
            <p className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
              {t('allowedTitle')}
            </p>
            <p className="text-yellow-800 dark:text-yellow-200">• {t('allowed1')}</p>
            <p className="text-yellow-800 dark:text-yellow-200">• {t('allowed2')}</p>
            <p className="text-yellow-800 dark:text-yellow-200">• {t('allowed3')}</p>

            <p className="font-semibold text-yellow-900 dark:text-yellow-100 mt-3 mb-2">
              {t('disabledBanTitle')}
            </p>
            <p className="text-yellow-800 dark:text-yellow-200">• {t('disabled1')}</p>
            <p className="text-yellow-800 dark:text-yellow-200">• {t('disabled2')}</p>
            <p className="text-yellow-800 dark:text-yellow-200">• {t('disabled3')}</p>
          </div>

          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            {t('safeLimit')}
          </p>

          <Button asChild variant="outline" className="border-yellow-400 text-yellow-800 hover:bg-yellow-100 dark:text-yellow-200">
            <Link href="/settings?tab=whatsapp">{t('configureBot')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
