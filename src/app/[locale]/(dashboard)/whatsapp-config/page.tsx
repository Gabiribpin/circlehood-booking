'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Image from 'next/image';
import { BotConfigPanel } from '@/components/dashboard/bot-config-panel';

type ConnectionStatus = 'idle' | 'loading' | 'qrcode' | 'connected' | 'error';

export default function WhatsAppConfigPage() {
  const t = useTranslations('whatsapp');

  // Evolution state
  const [evolutionPhone, setEvolutionPhone] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [instanceName, setInstanceName] = useState('');
  const [qrCode, setQrCode] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // AI / bot state
  const [greetingMessage, setGreetingMessage] = useState('');
  const [aiSettings, setAiSettings] = useState({
    languages: ['pt', 'en'],
    instructions: '',
  });

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

      const { data: bcData } = await supabase
        .from('bot_config')
        .select('greeting_message')
        .eq('user_id', user.id)
        .maybeSingle();

      if (bcData) {
        setGreetingMessage(bcData.greeting_message ?? '');
      }

      setLoading(false);
    }
    loadConfig();
  }, []);

  // ── Conectar WhatsApp via Evolution API ──
  async function handleConnect() {
    if (!evolutionPhone) {
      setEvoMessage(t('errorPhone'));
      setConnectionStatus('error');
      return;
    }

    setConnectionStatus('loading');
    setQrCode(null);
    setEvoMessage(null);

    try {
      const res = await fetch('/api/evolution/create-instance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: evolutionPhone }),
      });

      const data = await res.json();

      if (!res.ok) {
        setConnectionStatus('error');
        setEvoMessage(data.error ?? t('errorCreate'));
        return;
      }

      setInstanceName(data.instanceName);

      if (data.qrCode) {
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
        const qrRes = await fetch(`/api/evolution/get-qrcode?instance=${instance}`);
        if (qrRes.ok) {
          const qrData = await qrRes.json();
          if (qrData.qrCode && !qrCode) {
            setQrCode(qrData.qrCode);
            setConnectionStatus('qrcode');
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
          }
        }
      } catch {
        // Ignorar erros de polling
      }
    }, 3000);
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

      <Tabs defaultValue="setup" className="space-y-6">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    setConnectionStatus('idle');
                    setQrCode(null);
                  }}
                >
                  {t('cancel')}
                </Button>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    setConnectionStatus('idle');
                    setQrCode(null);
                  }}
                >
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
              <div className="space-y-3">
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
                <Button
                  onClick={handleConnect}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  {t('connectBtn')}
                </Button>
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
                onChange={(e) => setGreetingMessage(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">{t('greetingHint')}</p>
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
