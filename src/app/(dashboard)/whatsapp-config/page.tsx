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
    welcomeMessage: '',
    autoReminders: true,
    autoBirthdays: true,
    autoWaitlist: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metaMessage, setMetaMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [evoMessage, setEvoMessage] = useState<string | null>(null);

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

    setMetaMessage(error
      ? { type: 'error', text: `Erro: ${error.message}` }
      : { type: 'success', text: '✅ Configuração salva com sucesso!' }
    );
    setSaving(false);
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
        <TabsList>
          <TabsTrigger value="setup">Conexão</TabsTrigger>
          <TabsTrigger value="ai">IA & Automações</TabsTrigger>
          <TabsTrigger value="templates">Mensagens</TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Conexão ─── */}
        <TabsContent value="setup">
          <Card className="p-6 space-y-5">

            {/* Seletor de Provider */}
            <div>
              <Label className="mb-2 block">Provider WhatsApp</Label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setProvider('meta')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                    provider === 'meta'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  📘 Meta Business API
                  <p className="text-xs font-normal mt-1 opacity-70">Oficial do Facebook</p>
                </button>
                <button
                  type="button"
                  onClick={() => setProvider('evolution')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                    provider === 'evolution'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  🟢 Evolution API
                  <p className="text-xs font-normal mt-1 opacity-70">Open source, sem aprovação</p>
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
                    placeholder="+353 85 123 4567"
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
                    placeholder="Token permanente do WhatsApp Business API"
                    value={metaConfig.accessToken}
                    onChange={(e) => setMetaConfig({ ...metaConfig, accessToken: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="verifyToken">Verify Token *</Label>
                  <Input
                    id="verifyToken"
                    placeholder="Ex: circlehood_webhook_2024"
                    value={metaConfig.verifyToken}
                    onChange={(e) => setMetaConfig({ ...metaConfig, verifyToken: e.target.value })}
                  />
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
              <Label className="mb-2 block">Idiomas que o bot atende</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { code: 'pt', label: '🇧🇷 Português' },
                  { code: 'en', label: '🇬🇧 English' },
                  { code: 'ro', label: '🇷🇴 Română' },
                  { code: 'ar', label: '🇸🇦 العربية' },
                  { code: 'es', label: '🇪🇸 Español' },
                ].map((lang) => (
                  <label key={lang.code} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiSettings.languages.includes(lang.code)}
                      onChange={(e) => {
                        setAiSettings({
                          ...aiSettings,
                          languages: e.target.checked
                            ? [...aiSettings.languages, lang.code]
                            : aiSettings.languages.filter((l) => l !== lang.code),
                        });
                      }}
                    />
                    <span className="text-sm">{lang.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="instructions">Instruções personalizadas para a IA</Label>
              <Textarea
                id="instructions"
                rows={5}
                placeholder={`Exemplo:\n- Seja sempre educado e use emojis\n- Mencione promoções quando relevante`}
                value={aiSettings.instructions}
                onChange={(e) => setAiSettings({ ...aiSettings, instructions: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="welcome">Mensagem de boas-vindas</Label>
              <Textarea
                id="welcome"
                rows={3}
                placeholder="Olá! 👋 Bem-vindo(a)! Como posso ajudar hoje?"
                value={aiSettings.welcomeMessage}
                onChange={(e) => setAiSettings({ ...aiSettings, welcomeMessage: e.target.value })}
              />
            </div>

            <div className="space-y-3">
              <Label>Automações</Label>
              {[
                { key: 'autoReminders' as const, title: 'Lembretes automáticos', desc: 'Envia lembrete 24h antes do agendamento' },
                { key: 'autoBirthdays' as const, title: 'Mensagens de aniversário', desc: 'Parabeniza clientes automaticamente' },
                { key: 'autoWaitlist' as const, title: 'Lista de espera', desc: 'Notifica quando surgir vaga disponível' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                  <Switch
                    checked={aiSettings[item.key]}
                    onCheckedChange={(checked) => setAiSettings({ ...aiSettings, [item.key]: checked })}
                  />
                </div>
              ))}
            </div>

            <Button className="w-full" variant="outline">
              Salvar Configurações de IA
            </Button>
          </Card>
        </TabsContent>

        {/* ─── Tab 3: Templates ─── */}
        <TabsContent value="templates">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-2">💬 Templates de Mensagem</h2>
            <p className="text-sm text-gray-500 mb-6">
              Em breve: editor de mensagens personalizadas para confirmações, lembretes e aniversários.
            </p>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">📅 Confirmação de agendamento</p>
                <p className="text-gray-500 mt-1">
                  &quot;Olá {'{nome}'}! O teu agendamento de {'{servico}'} está confirmado para {'{data}'} às {'{hora}'}. ✅&quot;
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">⏰ Lembrete 24h antes</p>
                <p className="text-gray-500 mt-1">
                  &quot;Olá {'{nome}'}! Lembrete: tens {'{servico}'} amanhã às {'{hora}'}. Até já! 💅&quot;
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">🎂 Aniversário</p>
                <p className="text-gray-500 mt-1">
                  &quot;Feliz aniversário {'{nome}'}! 🎉 Como presente, tens 10% de desconto no próximo serviço!&quot;
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
