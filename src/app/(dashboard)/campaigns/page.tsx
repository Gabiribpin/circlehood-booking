import Link from 'next/link';
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
export default function CampaignsPage() {
  return (
    <div className="max-w-2xl mx-auto mt-12 px-4">
      <Card className="border-yellow-400/60 bg-yellow-50 dark:bg-yellow-950/20">
        <CardContent className="p-8 text-center space-y-4">
          <ShieldAlert className="h-12 w-12 text-yellow-600 mx-auto" />

          <h2 className="text-xl font-bold text-yellow-900 dark:text-yellow-100">
            Campanhas desativadas
          </h2>

          <p className="text-yellow-800 dark:text-yellow-200 text-sm leading-relaxed">
            Para proteger o seu número de WhatsApp contra bloqueio permanente,
            o envio em massa foi desativado. O CircleHood usa WhatsApp apenas
            em modo <strong>conversacional</strong>: o cliente inicia a conversa
            e o bot responde automaticamente.
          </p>

          <div className="bg-white dark:bg-yellow-900/30 rounded-lg p-4 text-left space-y-1 text-sm">
            <p className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
              ✅ Permitido:
            </p>
            <p className="text-yellow-800 dark:text-yellow-200">• Bot atende clientes que te procuram</p>
            <p className="text-yellow-800 dark:text-yellow-200">• Agendamento e reagendamento via WhatsApp</p>
            <p className="text-yellow-800 dark:text-yellow-200">• Confirmações automáticas de booking</p>

            <p className="font-semibold text-yellow-900 dark:text-yellow-100 mt-3 mb-2">
              ❌ Desativado (risco de ban):
            </p>
            <p className="text-yellow-800 dark:text-yellow-200">• Campanhas de marketing em massa</p>
            <p className="text-yellow-800 dark:text-yellow-200">• Lembretes automáticos para toda a base</p>
            <p className="text-yellow-800 dark:text-yellow-200">• Broadcast para múltiplos contactos</p>
          </div>

          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            Limite seguro: 50 mensagens/dia · Sistema controla automaticamente
          </p>

          <Button asChild variant="outline" className="border-yellow-400 text-yellow-800 hover:bg-yellow-100 dark:text-yellow-200">
            <Link href="/whatsapp-config">⚙️ Configurar WhatsApp Bot</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
