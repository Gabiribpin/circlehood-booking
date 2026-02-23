'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('whatsapp-warning-seen');
    if (!seen) setIsOpen(true);
  }, []);

  if (!isOpen) return null;

  const handleAccept = () => {
    localStorage.setItem('whatsapp-warning-seen', 'true');
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-card rounded-lg p-6 max-w-md w-full shadow-xl">
        <div className="text-center mb-5">
          <div className="text-5xl mb-3">⚠️</div>
          <h2 className="text-xl font-bold">Importante sobre WhatsApp</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Para proteger seu número contra bloqueio permanente
          </p>
        </div>

        <div className="space-y-3 text-sm mb-5">
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 rounded-md">
            <p className="font-semibold text-green-800 dark:text-green-400 mb-1">✅ Permitido:</p>
            <ul className="text-green-700 dark:text-green-500 space-y-0.5 pl-2">
              <li>• Bot responder clientes que te procuram</li>
              <li>• Agendamento conversacional</li>
              <li>• Confirmações individuais</li>
            </ul>
          </div>

          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 rounded-md">
            <p className="font-semibold text-red-800 dark:text-red-400 mb-1">❌ Proibido (risco de bloqueio):</p>
            <ul className="text-red-700 dark:text-red-500 space-y-0.5 pl-2">
              <li>• Enviar mensagens para muitos clientes de uma vez</li>
              <li>• Campanhas de marketing em massa</li>
              <li>• Lembretes automáticos para toda a base</li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Limite: 50 mensagens/dia — sistema controla automaticamente.
          </p>
        </div>

        <Button onClick={handleAccept} className="w-full">
          Entendi, vou usar com responsabilidade
        </Button>
      </div>
    </div>
  );
}
