'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PhoneInput } from '@/components/ui/phone-input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import { BotConfigPanel } from '@/components/dashboard/bot-config-panel';
import { QrCode, Smartphone } from 'lucide-react';

type ConnectionStatus = 'idle' | 'loading' | 'qrcode' | 'pairing' | 'connected' | 'error';

interface WhatsAppConfigClientProps {
  initialConfig: {
    phone: string;
    instanceName: string;
    isActive: boolean;
  };
}

export function WhatsAppConfigClient({ initialConfig }: WhatsAppConfigClientProps) {
  const t = useTranslations('whatsapp');

  // Evolution state
  const [evolutionPhone, setEvolutionPhone] = useState(initialConfig.phone);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    initialConfig.isActive ? 'connected' : 'idle'
  );
  const [instanceName, setInstanceName] = useState(initialConfig.instanceName);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Refs to track current state in polling closure
  const connectionStatusRef = useRef<ConnectionStatus>(initialConfig.isActive ? 'connected' : 'idle');
  const qrCodeRef = useRef<string | null>(null);

  const [evoMessage, setEvoMessage] = useState<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    connectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);

  useEffect(() => {
    qrCodeRef.current = qrCode;
  }, [qrCode]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ── Conectar WhatsApp via Evolution API ──
  async function handleConnect(method: 'qrcode' | 'pairing') {
    if (!evolutionPhone) {
      setEvoMessage(t('errorPhone'));
      setConnectionStatus('error');
      return;
    }

    setConnectionStatus('loading');
    setQrCode(null);
    setPairingCode(null);
    setEvoMessage(null);

    try {
      const res = await fetch('/api/evolution/create-instance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: evolutionPhone, method }),
      });

      const data = await res.json();

      if (!res.ok) {
        setConnectionStatus('error');
        setEvoMessage(data.error ?? t('errorCreate'));
        return;
      }

      setInstanceName(data.instanceName);

      if (method === 'pairing' && data.pairingCode) {
        setPairingCode(data.pairingCode);
        setConnectionStatus('pairing');
        startPolling(data.instanceName);
      } else if (data.qrCode) {
        setQrCode(data.qrCode);
        setConnectionStatus('qrcode');
        startPolling(data.instanceName);
      } else {
        startPolling(data.instanceName);
      }
    } catch {
      setConnectionStatus('error');
      setEvoMessage(t('errorServer'));
    }
  }

  const startPolling = useCallback((instance: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        // Use refs to read current state (avoids stale closure)
        if (connectionStatusRef.current === 'qrcode') {
          const qrRes = await fetch(`/api/evolution/get-qrcode?instance=${instance}`);
          if (qrRes.ok) {
            const qrData = await qrRes.json();
            if (qrData.qrCode) {
              setQrCode(qrData.qrCode);
            }
          }
        }

        const connRes = await fetch(`/api/evolution/check-connection?instance=${instance}`);
        if (connRes.ok) {
          const connData = await connRes.json();
          if (connData.connected) {
            clearInterval(pollingRef.current!);
            pollingRef.current = null;
            setConnectionStatus('connected');
            setQrCode(null);
            setPairingCode(null);
          }
        }
      } catch {
        // Ignorar erros de polling
      }
    }, 3000);
  }, []);

  function resetConnection() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setConnectionStatus('idle');
    setQrCode(null);
    setPairingCode(null);
  }

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">{t('configTitle')}</h1>
      <p className="text-muted-foreground mb-6">{t('configSubtitle')}</p>

      <Card className="p-6 space-y-5">

            {/* Badge — conexão ativa */}
            {connectionStatus === 'connected' && (
              <div className="mb-2 p-3 bg-green-50 dark:bg-green-950 border-2 border-green-500 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📱</span>
                  <div>
                    <p className="font-semibold text-green-900 dark:text-green-100">{t('connectedBadge')}</p>
                    {evolutionPhone && (
                      <p className="text-sm text-green-700 dark:text-green-300">{t('connectedNumber', { phone: evolutionPhone })}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* QR Code */}
            {connectionStatus === 'qrcode' && qrCode && (
              <div className="p-5 bg-muted border rounded-xl text-center space-y-4">
                <p className="font-semibold">{t('scanQR')}</p>
                <div className="flex justify-center">
                  <Image
                    src={qrCode}
                    alt="QR Code WhatsApp"
                    width={220}
                    height={220}
                    className="rounded-lg border"
                  />
                </div>
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <span className="animate-spin inline-block">🔄</span>
                  {t('waitingQR')}
                </p>
                <p className="text-xs text-muted-foreground">{t('qrInstructions')}</p>
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" size="sm" onClick={resetConnection}>
                    {t('cancel')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleConnect('pairing')}>
                    <Smartphone className="h-4 w-4 mr-1.5" />
                    {t('switchToPairing')}
                  </Button>
                </div>
              </div>
            )}

            {/* Pairing Code */}
            {connectionStatus === 'pairing' && pairingCode && (
              <div className="p-5 bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-xl text-center space-y-4">
                <Smartphone className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto" />
                <p className="font-semibold">{t('pairingTitle')}</p>
                <div className="bg-white dark:bg-blue-950/50 border-2 border-blue-300 dark:border-blue-700 rounded-xl py-4 px-6 inline-block">
                  <p className="text-3xl font-mono font-bold tracking-[0.3em] text-blue-700 dark:text-blue-300 select-all">
                    {pairingCode}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground space-y-1 max-w-sm mx-auto text-left">
                  <p>{t('pairingStep1')}</p>
                  <p>{t('pairingStep2')}</p>
                  <p>{t('pairingStep3')}</p>
                </div>
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <span className="animate-spin inline-block">🔄</span>
                  {t('waitingPairing')}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" size="sm" onClick={resetConnection}>
                    {t('cancel')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleConnect('qrcode')}>
                    <QrCode className="h-4 w-4 mr-1.5" />
                    {t('switchToQR')}
                  </Button>
                </div>
              </div>
            )}

            {/* Loading */}
            {connectionStatus === 'loading' && (
              <div className="p-5 bg-muted border rounded-xl text-center">
                <p className="text-muted-foreground">{t('creating')}</p>
              </div>
            )}

            {/* Conectado — botão de reconectar */}
            {connectionStatus === 'connected' && (
              <div className="space-y-4">
                <Button variant="outline" size="sm" onClick={resetConnection}>
                  {t('reconnect')}
                </Button>
              </div>
            )}

            {/* Erro */}
            {connectionStatus === 'error' && evoMessage && (
              <div className="p-3 rounded-lg text-sm bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
                {evoMessage}
              </div>
            )}

            {/* Formulário — número + conectar */}
            {(connectionStatus === 'idle' || connectionStatus === 'error') && (
              <div className="space-y-4">
                <div>
                  <Label>{t('phoneLabel')}</Label>
                  <PhoneInput
                    value={evolutionPhone}
                    onChange={(val) => setEvolutionPhone(val ?? '')}
                    placeholder="+55 11 99999-9999"
                    defaultCountry="BR"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('phoneHint')}</p>
                </div>

                {/* Two connection options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    onClick={() => handleConnect('qrcode')}
                    className="w-full bg-green-600 hover:bg-green-700 text-white h-auto py-3"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <QrCode className="h-5 w-5" />
                      <span className="text-sm font-semibold">{t('connectQR')}</span>
                      <span className="text-[10px] text-green-200 font-normal">{t('connectQRHint')}</span>
                    </div>
                  </Button>
                  <Button
                    onClick={() => handleConnect('pairing')}
                    variant="outline"
                    className="w-full h-auto py-3 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-semibold">{t('connectPairing')}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">{t('connectPairingHint')}</span>
                    </div>
                  </Button>
                </div>
              </div>
            )}
      </Card>
    </div>
  );
}

/* ── AI Assistant Section (separated for unified settings tab) ── */

interface AiAssistantSectionProps {
  initialConfig: {
    instructions: string;
    greetingMessage: string;
    businessName: string;
  };
}

export function AiAssistantSection({ initialConfig }: AiAssistantSectionProps) {
  const t = useTranslations('whatsapp');

  const greetingWasEmpty = !initialConfig.greetingMessage;
  const [greetingMessage, setGreetingMessage] = useState(
    initialConfig.greetingMessage ||
      (initialConfig.businessName
        ? `Olá, seja bem-vindo(a) ao ${initialConfig.businessName}! Como posso ajudar?`
        : '')
  );
  const [greetingEdited, setGreetingEdited] = useState(false);
  const [aiSettings, setAiSettings] = useState({
    languages: ['pt', 'en'],
    instructions: initialConfig.instructions,
  });

  const [savingAi, setSavingAi] = useState(false);
  const [aiMessage, setAiMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSaveAI() {
    setSavingAi(true);
    setAiMessage(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setAiMessage({ type: 'error', text: t('notAuthenticated') });
      setSavingAi(false);
      return;
    }

    await supabase
      .from('bot_config')
      .upsert(
        { user_id: user.id, greeting_message: greetingMessage || null, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    const upserts = aiSettings.languages.map((lang) => ({
      user_id: user.id,
      language: lang,
      instructions: aiSettings.instructions,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('ai_instructions')
      .upsert(upserts, { onConflict: 'user_id,language' });

    if (error) {
      setAiMessage({ type: 'error', text: t('saveAiError', { message: error.message }) });
    } else {
      setAiMessage({ type: 'success', text: t('saveAiSuccess') });
      setTimeout(() => setAiMessage(null), 5000);
    }
    setSavingAi(false);
  }

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <h2 className="text-xl font-semibold mb-4">{t('aiTitle')}</h2>

      <Card className="p-6 space-y-6">
        <div>
          <Label htmlFor="greeting_message">{t('greetingLabel')}</Label>
          <Textarea
            id="greeting_message"
            rows={2}
            placeholder={t('greetingPlaceholder')}
            value={greetingMessage}
            onChange={(e) => {
              setGreetingMessage(e.target.value);
              setGreetingEdited(true);
            }}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {greetingWasEmpty && !greetingEdited ? t('greetingDefault') : t('greetingHint')}
          </p>
        </div>

        <div>
          <Label htmlFor="instructions">
            {t('instructionsLabel')}
            <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">
              {t('instructionsWarning')}
            </span>
          </Label>
          <Textarea
            id="instructions"
            rows={5}
            placeholder={t('instructionsPlaceholder')}
            value={aiSettings.instructions}
            onChange={(e) => setAiSettings({ ...aiSettings, instructions: e.target.value })}
          />
          <p className="text-xs text-muted-foreground mt-1">{t('instructionsHint')}</p>
        </div>

        {aiMessage && (
          <div className={`p-3 rounded-lg text-sm ${
            aiMessage.type === 'success'
              ? 'bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}>
            {aiMessage.text}
          </div>
        )}

        <Button className="w-full" variant="outline" onClick={handleSaveAI} disabled={savingAi}>
          {savingAi ? t('saving') : t('saveAiBtn')}
        </Button>

        {/* Configuração avançada do bot */}
        <BotConfigPanel />
      </Card>
    </div>
  );
}
