'use client';

import { useState, useEffect, useRef } from 'react';
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

      // Carregar ai_instructions
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

      // Carregar greeting_message do bot_config
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
      setEvoMessage('Insere o número do WhatsApp.');
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
        setEvoMessage(data.error ?? 'Erro ao criar instância.');
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
      setEvoMessage('Erro de ligação ao servidor.');
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
      setAiMessage({ type: 'error', text: 'Utilizador não autenticado.' });
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
      setAiMessage({ type: 'error', text: `Erro: ${error.message}` });
    } else {
      setAiMessage({ type: 'success', text: '✅ Configurações de IA salvas!' });
      setTimeout(() => setAiMessage(null), 5000);
    }
    setSavingAi(false);
  }

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto p-6">
        <p className="text-gray-500">A carregar configuração...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">⚙️ Configuração WhatsApp</h1>
      <p className="text-gray-500 mb-6">Conecta o teu número ao bot de agendamento automático</p>

      <Tabs defaultValue="setup" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="setup">Conexão</TabsTrigger>
          <TabsTrigger value="ai">IA & Automações</TabsTrigger>
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
                    <p className="font-semibold text-green-900">WhatsApp Conectado</p>
                    {evolutionPhone && <p className="text-sm text-green-700">Número: {evolutionPhone}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Aviso de segurança — sempre visível */}
            <div className="p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
              <p className="font-semibold text-amber-800 text-sm mb-2">
                ⚠️ Importante: Uso seguro do WhatsApp
              </p>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>✅ Use o bot para <strong>atender clientes que te procuram</strong></li>
                <li>✅ Agendamentos, confirmações e atendimento conversacional</li>
                <li>❌ <strong>NÃO envie mensagens em massa</strong> ou campanhas de marketing</li>
                <li>❌ Envios massivos podem bloquear o número <strong>permanentemente</strong></li>
              </ul>
              <p className="text-xs text-amber-600 mt-2">
                Limite automático: 50 mensagens/dia · Sistema controla automaticamente
              </p>
            </div>

            {/* QR Code */}
            {connectionStatus === 'qrcode' && qrCode && (
              <div className="p-5 bg-gray-50 border rounded-xl text-center space-y-4">
                <p className="font-semibold text-gray-800">📱 Escaneia o QR Code com o WhatsApp</p>
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
                  Aguardando leitura...
                </p>
                <p className="text-xs text-gray-400">
                  WhatsApp → Dispositivos vinculados → Vincular dispositivo
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    setConnectionStatus('idle');
                    setQrCode(null);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            )}

            {/* Loading */}
            {connectionStatus === 'loading' && (
              <div className="p-5 bg-gray-50 border rounded-xl text-center">
                <p className="text-gray-600">⏳ A criar instância e gerar QR Code...</p>
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
                  Reconectar / Trocar número
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
                  <Label htmlFor="evolutionPhone">Número do WhatsApp *</Label>
                  <Input
                    id="evolutionPhone"
                    placeholder="+55 11 99999-9999"
                    value={evolutionPhone}
                    onChange={(e) => setEvolutionPhone(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Número que irás escanear — sem necessitar de configuração adicional
                  </p>
                </div>
                <Button
                  onClick={handleConnect}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  🟢 Conectar WhatsApp
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ─── Tab 2: IA & Automações ─── */}
        <TabsContent value="ai">
          <Card className="p-6 space-y-6">
            <h2 className="text-xl font-semibold">🤖 Configuração da IA</h2>

            <div>
              <Label htmlFor="greeting_message">Saudação inicial</Label>
              <Textarea
                id="greeting_message"
                rows={2}
                placeholder="Olá! 👋 Bem-vinda ao salão da Maria! Como posso ajudar?"
                value={greetingMessage}
                onChange={(e) => setGreetingMessage(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Mensagem enviada quando o cliente entra em contato pela primeira vez.
              </p>
            </div>

            <div>
              <Label htmlFor="instructions">
                Instruções personalizadas para a IA
                <span className="ml-2 text-xs text-yellow-600">
                  ⚠️ Complementares (não substituem regras padrão)
                </span>
              </Label>
              <Textarea
                id="instructions"
                rows={5}
                placeholder={`Exemplo:\n- Seja sempre educado e use emojis\n- Mencione promoções quando relevante`}
                value={aiSettings.instructions}
                onChange={(e) => setAiSettings({ ...aiSettings, instructions: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Instruções específicas do seu negócio que o bot deve seguir.
              </p>
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
              {savingAi ? 'A salvar...' : 'Salvar Configurações de IA'}
            </Button>

            {/* Configuração avançada do bot */}
            <BotConfigPanel />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
