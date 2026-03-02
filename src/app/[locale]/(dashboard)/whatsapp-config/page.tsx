'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Image from 'next/image';
import { Switch } from '@/components/ui/switch';
import { BotConfigPanel } from '@/components/dashboard/bot-config-panel';
import { QrCode, Smartphone } from 'lucide-react';

type ConnectionStatus = 'idle' | 'loading' | 'qrcode' | 'pairing' | 'connected' | 'error';

export default function WhatsAppConfigPage() {
  const t = useTranslations('whatsapp');
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') === 'ai' ? 'ai' : 'setup';

  // Evolution state
  const [evolutionPhone, setEvolutionPhone] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [instanceName, setInstanceName] = useState('');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // AI / bot state
  const [greetingMessage, setGreetingMessage] = useState('');
  const [greetingWasEmpty, setGreetingWasEmpty] = useState(false);
  const [aiSettings, setAiSettings] = useState({
    languages: ['pt', 'en'],
    instructions: '',
  });

  const [botEnabled, setBotEnabled] = useState(true);
  const [togglingBot, setTogglingBot] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingAi, setSavingAi] = useState(false);
  const [evoMessage, setEvoMessage] = useState<string | null>(null);
  const [aiMessage, setAiMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  useEffect(() => {
    async function loadConfig() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setEvolutionPhone(data.business_phone ?? '');
        setInstanceName(data.evolution_instance ?? '');
        setBotEnabled(data.bot_enabled !== false);
        if (data.is_active) setConnectionStatus('connected');
      }

      const { data: aiData } = await supabase
        .from('ai_instructions')
        .select('instructions')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (aiData) {
        setAiSettings(prev => ({ ...prev, instructions: aiData.instructions ?? '' }));
      }

      const [{ data: bcData }, { data: profData }] = await Promise.all([
        supabase
          .from('bot_config')
          .select('greeting_message')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('professionals')
          .select('business_name')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      const savedGreeting = bcData?.greeting_message ?? '';
      if (savedGreeting) {
        setGreetingMessage(savedGreeting);
      } else {
        // Pre-fill with a sensible default using the business name
        const name = profData?.business_name ?? '';
        setGreetingMessage(
          name
            ? `Olá, seja bem-vindo(a) ao ${name}! Como posso ajudar?`
            : ''
        );
        setGreetingWasEmpty(true);
      }

      setLoading(false);
    }
    loadConfig();
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

  function startPolling(instance: string) {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        // Only fetch QR if we're in qrcode mode
        if (connectionStatus === 'qrcode') {
          const qrRes = await fetch(`/api/evolution/get-qrcode?instance=${instance}`);
          if (qrRes.ok) {
            const qrData = await qrRes.json();
            if (qrData.qrCode && !qrCode) {
              setQrCode(qrData.qrCode);
              setConnectionStatus('qrcode');
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
  }

  function resetConnection() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setConnectionStatus('idle');
    setQrCode(null);
    setPairingCode(null);
  }

  // ── Salvar configurações de IA ──
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

  async function handleToggleBot(enabled: boolean) {
    setTogglingBot(true);
    try {
      const res = await fetch('/api/whatsapp/bot-toggle', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (!res.ok) {
        setEvoMessage(t('botToggleError'));
      } else {
        const data = await res.json();
        setBotEnabled(data.enabled);
      }
    } catch {
      setEvoMessage(t('botToggleError'));
    } finally {
      setTogglingBot(false);
    }
  }

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto p-6">
        <p className="text-gray-500">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">{t('configTitle')}</h1>
      <p className="text-gray-500 mb-6">{t('configSubtitle')}</p>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="setup">{t('tabConnection')}</TabsTrigger>
          <TabsTrigger value="ai">{t('tabAI')}</TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Conexão ─── */}
        <TabsContent value="setup">
          <Card className="p-6 space-y-5">

            {/* Badge — conexão ativa */}
            {connectionStatus === 'connected' && (
              <div className="mb-2 p-3 bg-green-50 border-2 border-green-500 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📱</span>
                  <div>
                    <p className="font-semibold text-green-900">{t('connectedBadge')}</p>
                    {evolutionPhone && (
                      <p className="text-sm text-green-700">{t('connectedNumber', { phone: evolutionPhone })}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Bot toggle — visível quando conectado */}
            {connectionStatus === 'connected' && (
              <div className={`p-3 rounded-lg border-2 ${botEnabled ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-300'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{botEnabled ? '🤖' : '🔇'}</span>
                    <div>
                      <p className="font-medium text-sm">
                        {botEnabled ? t('botEnabledLabel') : t('botDisabledBadge')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {botEnabled ? t('botEnabledHint') : t('botDisabledHint')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="bot-enabled"
                    checked={botEnabled}
                    onCheckedChange={handleToggleBot}
                    disabled={togglingBot}
                  />
                </div>
              </div>
            )}

            {/* QR Code */}
            {connectionStatus === 'qrcode' && qrCode && (
              <div className="p-5 bg-gray-50 border rounded-xl text-center space-y-4">
                <p className="font-semibold text-gray-800">{t('scanQR')}</p>
                <div className="flex justify-center">
                  <Image
                    src={qrCode}
                    alt="QR Code WhatsApp"
                    width={220}
                    height={220}
                    className="rounded-lg border"
                  />
                </div>
                <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
                  <span className="animate-spin inline-block">🔄</span>
                  {t('waitingQR')}
                </p>
                <p className="text-xs text-gray-400">{t('qrInstructions')}</p>
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
              <div className="p-5 bg-blue-50 border-2 border-blue-200 rounded-xl text-center space-y-4">
                <Smartphone className="h-8 w-8 text-blue-600 mx-auto" />
                <p className="font-semibold text-gray-800">{t('pairingTitle')}</p>
                <div className="bg-white border-2 border-blue-300 rounded-xl py-4 px-6 inline-block">
                  <p className="text-3xl font-mono font-bold tracking-[0.3em] text-blue-700 select-all">
                    {pairingCode}
                  </p>
                </div>
                <div className="text-sm text-gray-600 space-y-1 max-w-sm mx-auto text-left">
                  <p>{t('pairingStep1')}</p>
                  <p>{t('pairingStep2')}</p>
                  <p>{t('pairingStep3')}</p>
                </div>
                <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
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
              <div className="p-5 bg-gray-50 border rounded-xl text-center">
                <p className="text-gray-600">{t('creating')}</p>
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
              <div className="p-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
                {evoMessage}
              </div>
            )}

            {/* Formulário — número + conectar */}
            {(connectionStatus === 'idle' || connectionStatus === 'error') && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="evolutionPhone">{t('phoneLabel')}</Label>
                  <Input
                    id="evolutionPhone"
                    placeholder="+55 11 99999-9999"
                    value={evolutionPhone}
                    onChange={(e) => setEvolutionPhone(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('phoneHint')}</p>
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
                    className="w-full h-auto py-3 border-blue-200 hover:bg-blue-50"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Smartphone className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-semibold">{t('connectPairing')}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">{t('connectPairingHint')}</span>
                    </div>
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ─── Tab 2: IA & Automações ─── */}
        <TabsContent value="ai">
          <Card className="p-6 space-y-6">
            <h2 className="text-xl font-semibold">{t('aiTitle')}</h2>

            <div>
              <Label htmlFor="greeting_message">{t('greetingLabel')}</Label>
              <Textarea
                id="greeting_message"
                rows={2}
                placeholder={t('greetingPlaceholder')}
                value={greetingMessage}
                onChange={(e) => {
                  setGreetingMessage(e.target.value);
                  setGreetingWasEmpty(false);
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                {greetingWasEmpty ? t('greetingDefault') : t('greetingHint')}
              </p>
            </div>

            <div>
              <Label htmlFor="instructions">
                {t('instructionsLabel')}
                <span className="ml-2 text-xs text-yellow-600">
                  {t('instructionsWarning')}
                </span>
              </Label>
              <Textarea
                id="instructions"
                rows={5}
                placeholder={`Exemplo:\n- Seja sempre educado e use emojis\n- Mencione promoções quando relevante`}
                value={aiSettings.instructions}
                onChange={(e) => setAiSettings({ ...aiSettings, instructions: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">{t('instructionsHint')}</p>
            </div>

            {aiMessage && (
              <div className={`p-3 rounded-lg text-sm ${
                aiMessage.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
