'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function WhatsAppConfigPage() {
  const [config, setConfig] = useState({
    phoneNumberId: '',
    accessToken: '',
    verifyToken: '',
    businessPhone: '',
    isActive: false,
  });

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
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Carregar configuração existente ao abrir a página
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
        setConfig({
          phoneNumberId: data.phone_number_id ?? '',
          accessToken: data.access_token ?? '',
          verifyToken: data.verify_token ?? '',
          businessPhone: data.business_phone ?? '',
          isActive: data.is_active ?? false,
        });
      }
      setLoading(false);
    }
    loadConfig();
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setMessage({ type: 'error', text: 'Utilizador não autenticado.' });
      setSaving(false);
      return;
    }

    if (!config.phoneNumberId || !config.accessToken || !config.verifyToken || !config.businessPhone) {
      setMessage({ type: 'error', text: 'Preencha todos os campos obrigatórios.' });
      setSaving(false);
      return;
    }

    const payload = {
      user_id: user.id,
      phone_number_id: config.phoneNumberId,
      access_token: config.accessToken,
      verify_token: config.verifyToken,
      business_phone: config.businessPhone,
      is_active: config.isActive,
      updated_at: new Date().toISOString(),
    };

    // Upsert: cria se não existe, atualiza se já existe
    const { error } = await supabase
      .from('whatsapp_config')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) {
      setMessage({ type: 'error', text: `Erro ao salvar: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: '✅ Configuração salva com sucesso!' });
    }

    setSaving(false);
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
      <h1 className="text-3xl font-bold mb-2">⚙️ Configuração WhatsApp Business</h1>
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
            <h2 className="text-xl font-semibold">1️⃣ Credenciais da API</h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="businessPhone">Número do WhatsApp Business *</Label>
                <Input
                  id="businessPhone"
                  placeholder="+353 85 123 4567"
                  value={config.businessPhone}
                  onChange={(e) => setConfig({ ...config, businessPhone: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="phoneNumberId">Phone Number ID *</Label>
                <Input
                  id="phoneNumberId"
                  placeholder="Ex: 123456789012345"
                  value={config.phoneNumberId}
                  onChange={(e) => setConfig({ ...config, phoneNumberId: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Encontras em Meta for Developers → WhatsApp → API Setup
                </p>
              </div>

              <div>
                <Label htmlFor="accessToken">Access Token *</Label>
                <Input
                  id="accessToken"
                  type="password"
                  placeholder="Token permanente do WhatsApp Business API"
                  value={config.accessToken}
                  onChange={(e) => setConfig({ ...config, accessToken: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Token de acesso permanente (não o temporário de 24h)
                </p>
              </div>

              <div>
                <Label htmlFor="verifyToken">Verify Token *</Label>
                <Input
                  id="verifyToken"
                  placeholder="Palavra secreta que defines tu (ex: circlehood_webhook_2024)"
                  value={config.verifyToken}
                  onChange={(e) => setConfig({ ...config, verifyToken: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Usa este token ao configurar o Webhook no Meta Developer Portal
                </p>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <Switch
                  id="active"
                  checked={config.isActive}
                  onCheckedChange={(checked) => setConfig({ ...config, isActive: checked })}
                />
                <Label htmlFor="active" className="cursor-pointer">
                  {config.isActive ? '🟢 Bot ativo' : '🔴 Bot inativo'}
                </Label>
              </div>
            </div>

            {/* Feedback */}
            {message && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {message.text}
              </div>
            )}

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? 'A salvar...' : 'Salvar Configuração'}
            </Button>

            {/* URL do Webhook */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg space-y-2">
              <p className="text-sm font-semibold text-blue-800">📋 URL do Webhook para o Meta:</p>
              <code className="text-xs bg-white border rounded px-2 py-1 block text-blue-700 break-all">
                {typeof window !== 'undefined' ? window.location.origin : 'https://seudominio.com'}
                /api/whatsapp/webhook
              </code>
              <p className="text-xs text-blue-600">
                Cola esta URL no Meta Developer Portal → Webhooks → Callback URL
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700 font-semibold mb-2">📚 Como configurar:</p>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Acessa <strong>developers.facebook.com</strong> e cria um app</li>
                <li>Adiciona o produto <strong>WhatsApp Business</strong></li>
                <li>Copia o <strong>Phone Number ID</strong> e gera o <strong>Access Token</strong></li>
                <li>Em Webhooks, cola a URL acima e o teu <strong>Verify Token</strong></li>
                <li>Subscreve ao evento <strong>messages</strong></li>
              </ol>
            </div>
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
                placeholder={`Exemplo:\n- Seja sempre educado e use emojis\n- Mencione promoções quando relevante\n- Pergunte se o cliente tem preferência especial`}
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
                {
                  key: 'autoReminders' as const,
                  title: 'Lembretes automáticos',
                  desc: 'Envia lembrete 24h antes do agendamento',
                },
                {
                  key: 'autoBirthdays' as const,
                  title: 'Mensagens de aniversário',
                  desc: 'Parabeniza clientes automaticamente',
                },
                {
                  key: 'autoWaitlist' as const,
                  title: 'Lista de espera',
                  desc: 'Notifica quando surgir vaga disponível',
                },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                  <Switch
                    checked={aiSettings[item.key]}
                    onCheckedChange={(checked) =>
                      setAiSettings({ ...aiSettings, [item.key]: checked })
                    }
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
