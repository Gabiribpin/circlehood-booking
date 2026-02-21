'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Image from 'next/image';
import { BotConfigPanel } from '@/components/dashboard/bot-config-panel';

type Provider = 'meta' | 'evolution';
type ConnectionStatus = 'idle' | 'loading' | 'qrcode' | 'connected' | 'error';

export default function WhatsAppConfigPage() {
  const [provider, setProvider] = useState<Provider>('meta');

  // Meta config
  const [metaConfig, setMetaConfig] = useState({
    phoneNumberId: '',
    accessToken: '',
    verifyToken: '',
    businessPhone: '',
    isActive: false,
  });

  // Evolution — só o número é visível ao utilizador
  const [evolutionPhone, setEvolutionPhone] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [instanceName, setInstanceName] = useState('');
  const [qrCode, setQrCode] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [aiSettings, setAiSettings] = useState({
    languages: ['pt', 'en'],
    instructions: '',
    // welcomeMessage removido - bot usa greeting_message do BotConfigPanel
    autoReminders: true,
    autoBirthdays: true,
    autoWaitlist: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [metaMessage, setMetaMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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
        const savedProvider: Provider = data.provider ?? 'meta';
        setProvider(savedProvider);

        setMetaConfig({
          phoneNumberId: data.phone_number_id ?? '',
          accessToken: data.access_token ?? '',
          verifyToken: data.verify_token ?? '',
          businessPhone: data.business_phone ?? '',
          isActive: data.is_active ?? false,
        });

        if (savedProvider === 'evolution') {
          setEvolutionPhone(data.business_phone ?? '');
          setInstanceName(data.evolution_instance ?? '');
          if (data.is_active) setConnectionStatus('connected');
        }
      }

      // Carregar ai_instructions (pega a mais recente)
      const { data: aiData } = await supabase
        .from('ai_instructions')
        .select('instructions, welcome_message')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (aiData) {
        setAiSettings(prev => ({
          ...prev,
          instructions: aiData.instructions ?? '',
          // welcomeMessage removido - bot usa bot_config.greeting_message
        }));
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
        // Sem QR code — verificar se já está conectado
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
        // Tentar obter QR Code atualizado
        const qrRes = await fetch(`/api/evolution/get-qrcode?instance=${instance}`);
        if (qrRes.ok) {
          const qrData = await qrRes.json();
          if (qrData.qrCode && !qrCode) {
            setQrCode(qrData.qrCode);
            setConnectionStatus('qrcode');
          }
        }

        // Verificar conexão
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

  // ── Salvar Meta API ──
  async function handleSaveMeta() {
    setSaving(true);
    setMetaMessage(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setMetaMessage({ type: 'error', text: 'Utilizador não autenticado.' });
      setSaving(false);
      return;
    }

    if (!metaConfig.phoneNumberId || !metaConfig.accessToken || !metaConfig.verifyToken || !metaConfig.businessPhone) {
      setMetaMessage({ type: 'error', text: 'Preencha todos os campos obrigatórios.' });
      setSaving(false);
      return;
    }

    // Validação 1: Formato do número de telefone
    const phoneDigitsOnly = metaConfig.businessPhone.replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^\+?\d{10,15}$/;
    if (!phoneRegex.test(phoneDigitsOnly)) {
      setMetaMessage({
        type: 'error',
        text: 'Número de telefone inválido. Use formato internacional (ex: +353851234567)',
      });
      setSaving(false);
      return;
    }

    // Validação 2: Phone Number ID (deve ser numérico)
    if (!/^\d+$/.test(metaConfig.phoneNumberId)) {
      setMetaMessage({
        type: 'error',
        text: 'Phone Number ID inválido. Deve conter apenas números.',
      });
      setSaving(false);
      return;
    }

    // Validação 3: Access Token (deve começar com EAA)
    if (!metaConfig.accessToken.startsWith('EAA')) {
      setMetaMessage({
        type: 'error',
        text: 'Access Token inválido. Tokens da Meta começam com "EAA".',
      });
      setSaving(false);
      return;
    }

    // Validação 4: Verify Token (mínimo 10 caracteres)
    if (metaConfig.verifyToken.length < 10) {
      setMetaMessage({
        type: 'error',
        text: 'Verify Token muito curto. Use no mínimo 10 caracteres para segurança.',
      });
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from('whatsapp_config')
      .upsert({
        user_id: user.id,
        provider: 'meta',
        phone_number_id: metaConfig.phoneNumberId,
        access_token: metaConfig.accessToken,
        verify_token: metaConfig.verifyToken,
        business_phone: metaConfig.businessPhone,
        is_active: metaConfig.isActive,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      setMetaMessage({ type: 'error', text: `Erro: ${error.message}` });
    } else {
      setMetaMessage({ type: 'success', text: '✅ Configuração salva com sucesso!' });
      setTimeout(() => setMetaMessage(null), 5000);
    }
    setSaving(false);
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

    // Upsert em ai_instructions para cada idioma selecionado
    const upserts = aiSettings.languages.map((lang) => ({
      user_id: user.id,
      language: lang,
      instructions: aiSettings.instructions,
      // welcome_message removido - bot usa bot_config.greeting_message
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

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook`
      : 'https://seudominio.com/api/whatsapp/webhook';

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
            {provider === 'evolution' && connectionStatus === 'connected' && (
              <div className="mb-2 p-3 bg-green-50 border-2 border-green-500 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📱</span>
                  <div>
                    <p className="font-semibold text-green-900">WhatsApp Normal Conectado</p>
                    {evolutionPhone && <p className="text-sm text-green-700">Número: {evolutionPhone}</p>}
                  </div>
                </div>
              </div>
            )}
            {provider === 'meta' && metaConfig.isActive && (
              <div className="mb-2 p-3 bg-blue-50 border-2 border-blue-500 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">💼</span>
                  <div>
                    <p className="font-semibold text-blue-900">WhatsApp Business Oficial Conectado</p>
                    {metaConfig.businessPhone && <p className="text-sm text-blue-700">Número: {metaConfig.businessPhone}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Seletor de Provider */}
            <div>
              <Label className="mb-2 block">Provider WhatsApp</Label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setProvider('meta')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-colors text-left ${
                    provider === 'meta'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  💼 WhatsApp Business Oficial
                  <p className="text-xs font-normal mt-1 opacity-80">Recomendado para campanhas e negócios</p>
                  <p className="text-xs font-normal opacity-60">Requer aprovação do Facebook</p>
                </button>
                <button
                  type="button"
                  onClick={() => setProvider('evolution')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-colors text-left ${
                    provider === 'evolution'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  📱 WhatsApp Normal
                  <p className="text-xs font-normal mt-1 opacity-80">Rápido e fácil (sem aprovação)</p>
                  <p className="text-xs font-normal opacity-60">⚠️ Não use para envio em massa</p>
                </button>
              </div>
            </div>

            {/* ── Meta ── */}
            {provider === 'meta' && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Credenciais Meta Business</h2>

                <div>
                  <Label htmlFor="businessPhone">Número do WhatsApp Business *</Label>
                  <Input
                    id="businessPhone"
                    placeholder="+55 11 99999-9999"
                    value={metaConfig.businessPhone}
                    onChange={(e) => setMetaConfig({ ...metaConfig, businessPhone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="phoneNumberId">Phone Number ID *</Label>
                  <Input
                    id="phoneNumberId"
                    placeholder="Ex: 123456789012345"
                    value={metaConfig.phoneNumberId}
                    onChange={(e) => setMetaConfig({ ...metaConfig, phoneNumberId: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Meta for Developers → WhatsApp → API Setup</p>
                </div>
                <div>
                  <Label htmlFor="accessToken">Access Token *</Label>
                  <Input
                    id="accessToken"
                    type="password"
                    placeholder="EAAx...your_access_token"
                    value={metaConfig.accessToken}
                    onChange={(e) => setMetaConfig({ ...metaConfig, accessToken: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="verifyToken">Verify Token *</Label>
                  <Input
                    id="verifyToken"
                    placeholder="meu_token_verificacao_2024"
                    value={metaConfig.verifyToken}
                    onChange={(e) => setMetaConfig({ ...metaConfig, verifyToken: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Escolha um token qualquer (você define)</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Switch
                    id="active-meta"
                    checked={metaConfig.isActive}
                    onCheckedChange={(checked) => setMetaConfig({ ...metaConfig, isActive: checked })}
                  />
                  <Label htmlFor="active-meta" className="cursor-pointer">
                    {metaConfig.isActive ? '🟢 Bot ativo' : '🔴 Bot inativo'}
                  </Label>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg space-y-2">
                  <p className="text-sm font-semibold text-blue-800">📋 URL do Webhook para o Meta:</p>
                  <code className="text-xs bg-white border rounded px-2 py-1 block text-blue-700 break-all">
                    {webhookUrl}
                  </code>
                </div>

                {metaMessage && (
                  <div className={`p-3 rounded-lg text-sm ${
                    metaMessage.type === 'success'
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {metaMessage.text}
                  </div>
                )}

                <Button onClick={handleSaveMeta} disabled={saving} className="w-full">
                  {saving ? 'A salvar...' : 'Salvar Configuração'}
                </Button>
              </div>
            )}

            {/* ── Evolution API — Fluxo QR Code ── */}
            {provider === 'evolution' && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Conectar WhatsApp</h2>

                {/* Conectado */}
                {connectionStatus === 'connected' && (
                  <div className="space-y-4">
                    <div className="p-5 bg-green-50 border border-green-200 rounded-xl text-center space-y-2">
                      <p className="text-4xl">✅</p>
                      <p className="font-semibold text-green-800 text-lg">WhatsApp conectado!</p>
                      <p className="text-sm text-green-700">Bot ativo para {evolutionPhone}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          if (pollingRef.current) clearInterval(pollingRef.current);
                          setConnectionStatus('idle');
                          setQrCode(null);
                        }}
                      >
                        Reconectar / Trocar número
                      </Button>
                    </div>
                    <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">⚠️</span>
                        <div>
                          <p className="font-semibold text-yellow-900 mb-2">Importante: Uso recomendado</p>
                          <ul className="text-sm text-yellow-800 space-y-1">
                            <li>✅ Responder clientes que te contatam</li>
                            <li>✅ Agendar horários individualmente</li>
                            <li>✅ Atendimento normal do dia a dia</li>
                            <li>❌ NÃO enviar mensagens em massa</li>
                            <li>❌ NÃO fazer campanhas de marketing</li>
                          </ul>
                          <p className="text-xs text-yellow-700 mt-2">
                            Envios massivos podem resultar em bloqueio do número pelo WhatsApp
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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

                {/* Erro */}
                {connectionStatus === 'error' && evoMessage && (
                  <div className="p-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
                    {evoMessage}
                  </div>
                )}

                {/* Formulário — só número */}
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
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ─── Tab 2: IA & Automações ─── */}
        <TabsContent value="ai">
          <Card className="p-6 space-y-6">
            <h2 className="text-xl font-semibold">🤖 Configuração da IA</h2>

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
                <strong>Nota:</strong> Instruções muito específicas podem ser sobrescritas pelas regras
                padrão do bot (apresentação, agendamento, cancelamento). Para controle total, use o
                &quot;Prompt do sistema (avançado)&quot; na seção abaixo.
              </p>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-sm text-blue-900 mb-2">
                🔔 Automações Ativas
              </h4>
              <ul className="text-xs text-blue-800 space-y-1.5 ml-4">
                <li className="flex items-start">
                  <span className="mr-2">✅</span>
                  <div>
                    <strong>Lembretes 24h antes:</strong> Sempre ativo. Bot envia lembrete
                    automático 24h antes de cada agendamento.
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✅</span>
                  <div>
                    <strong>Mensagens de aniversário:</strong> Sempre ativo. Bot parabeniza
                    clientes automaticamente no dia do aniversário.
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">⏳</span>
                  <div>
                    <strong>Lista de espera:</strong> Em desenvolvimento. Notificará clientes
                    quando surgirem vagas disponíveis.
                  </div>
                </li>
              </ul>
              <p className="text-xs text-blue-700 mt-3">
                <strong>Nota:</strong> Estas automações funcionam automaticamente via sistema
                de agendamento (cron jobs). Não precisam de configuração manual.
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

        {/* Tab Templates removida - configurações de mensagens estão no BotConfigPanel */}
      </Tabs>
    </div>
  );
}
